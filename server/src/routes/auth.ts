import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { type AuthDeps, SESSION_COOKIE, requireAuth } from '../plugins/auth';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { createLoginSchutz } from '../auth/loginSchutz';
import { toPublicUser } from '../domain/types';

// Laengen-Obergrenzen (Review P3-2): kein unbegrenzt langer Benutzername/Passwort-Body.
const LoginBody = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(1000),
});

export interface AuthRouteOpts {
  /** In Produktion: Cookie nur ueber HTTPS senden (ADR-07). */
  secureCookies: boolean;
  /** Cookie-Lebensdauer — an die Session-TTL gekoppelt. */
  sessionTtlMs: number;
}

/**
 * Dummy-Hash gegen User-Enumeration per Timing: Bei unbekanntem Benutzernamen wird trotzdem
 * ein bcrypt-Vergleich ausgefuehrt, damit die Antwortzeit nicht verraet, ob der Name existiert.
 */
const dummyHashPromise = hashPassword('timing-equalizer-dummy');

export function authRoutes(app: FastifyInstance, deps: AuthDeps, opts: AuthRouteOpts): void {
  // Fehlversuchs-Sperre GETRENNT je Konto und je Client-IP (Review P2-9). Das Konto-Limit ist
  // scharf (5); das IP-Limit ist bewusst lockerer (50), weil hinter dem Reverse Proxy / NAT viele
  // legitime Nutzer dieselbe IP teilen — sonst sperrten 5 Fehlversuche eines Einzelnen alle aus.
  // Voraussetzung fuer eine SINNVOLLE IP ist die trustProxy-Konfiguration (app.ts): ohne sie waere
  // req.ip hinter einem Proxy immer die Proxy-Adresse.
  const kontoSchutz = createLoginSchutz();
  const ipSchutz = createLoginSchutz({ maxVersuche: 50 });

  app.post('/api/auth/login', async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ungültige Eingabe' });
    }
    const { username, password } = parsed.data;
    const userKey = `u:${username.toLowerCase()}`;
    const ipKey = `ip:${req.ip}`;
    if (kontoSchutz.gesperrt(userKey) || ipSchutz.gesperrt(ipKey)) {
      req.log.warn({ username, ip: req.ip }, 'Login gesperrt (zu viele Fehlversuche)');
      return reply.code(429).send({ error: 'Zu viele Fehlversuche — bitte in einigen Minuten erneut versuchen.' });
    }
    const user = await deps.users.findByUsername(username);
    const hash = user?.passwordHash ?? (await dummyHashPromise);
    const ok = await verifyPassword(password, hash);
    if (!user || !ok) {
      // Fehlversuch protokollieren OHNE Passwort (Review P3.7); in der Antwort bewusst
      // keine Unterscheidung, ob Benutzer oder Passwort falsch ist.
      // BEIDE Zaehler immer erhoehen (kein ||-Kurzschluss — sonst zaehlte die IP nicht mit).
      const kontoGesperrt = kontoSchutz.fehlversuch(userKey);
      const ipGesperrt = ipSchutz.fehlversuch(ipKey);
      const jetztGesperrt = kontoGesperrt || ipGesperrt;
      req.log.warn({ username, ip: req.ip, gesperrt: jetztGesperrt }, 'Login fehlgeschlagen');
      return reply.code(401).send({ error: 'Benutzername oder Passwort falsch' });
    }
    kontoSchutz.erfolg(userKey);
    ipSchutz.erfolg(ipKey);
    const sid = deps.sessions.create(user.id);
    reply.setCookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secureCookies,
      signed: true,
      path: '/',
      maxAge: Math.floor(opts.sessionTtlMs / 1000),
    });
    return toPublicUser(user);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const raw = req.cookies[SESSION_COOKIE];
    if (raw) {
      const unsigned = req.unsignCookie(raw);
      if (unsigned.valid && unsigned.value) deps.sessions.destroy(unsigned.value);
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => req.currentUser);
}
