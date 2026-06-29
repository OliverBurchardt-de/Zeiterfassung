import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { type AuthDeps, SESSION_COOKIE, requireAuth } from '../plugins/auth';
import { verifyPassword } from '../auth/passwords';
import { toPublicUser } from '../domain/types';

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export function authRoutes(app: FastifyInstance, deps: AuthDeps): void {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ungültige Eingabe' });
    }
    const { username, password } = parsed.data;
    const user = await deps.users.findByUsername(username);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      // Bewusst keine Unterscheidung, ob Benutzer oder Passwort falsch ist.
      return reply.code(401).send({ error: 'Benutzername oder Passwort falsch' });
    }
    const sid = deps.sessions.create(user.id);
    reply.setCookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      signed: true,
      path: '/',
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
