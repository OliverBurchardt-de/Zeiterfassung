import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from 'fastify';
import type { SessionStore } from '../auth/sessions';
import type { UserRepository } from '../domain/ports';
import { toPublicUser, type PublicUser, type Role } from '../domain/types';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: PublicUser | null;
  }
}

export const SESSION_COOKIE = 'sid';

export interface AuthDeps {
  sessions: SessionStore;
  users: UserRepository;
}

/**
 * Liest bei jedem Request das Session-Cookie, validiert es und haengt den angemeldeten
 * Nutzer (ohne Passwort-Hash) an request.currentUser. Setzt nur — erzwingt nicht.
 */
export function registerAuth(app: FastifyInstance, deps: AuthDeps): void {
  app.decorateRequest('currentUser', null);

  app.addHook('onRequest', async (req) => {
    const raw = req.cookies[SESSION_COOKIE];
    if (!raw) return;
    const unsigned = req.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return;
    const session = deps.sessions.get(unsigned.value);
    if (!session) return;
    const user = await deps.users.findById(session.userId);
    if (user) req.currentUser = toPublicUser(user);
  });
}

/** preHandler: verlangt einen angemeldeten Nutzer. */
export function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  if (!req.currentUser) {
    reply.code(401).send({ error: 'nicht angemeldet' });
    return;
  }
  done();
}

/** preHandler-Fabrik: verlangt eine der angegebenen Rollen (bzw. Admin). */
export function requireRole(...roles: Array<Role | 'admin'>) {
  return (req: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void => {
    const u = req.currentUser;
    if (!u) {
      reply.code(401).send({ error: 'nicht angemeldet' });
      return;
    }
    const ok = roles.some((r) => (r === 'admin' ? u.admin : u.role === r));
    if (!ok) {
      reply.code(403).send({ error: 'keine Berechtigung' });
      return;
    }
    done();
  };
}
