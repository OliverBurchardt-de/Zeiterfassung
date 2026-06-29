import { randomBytes } from 'node:crypto';

/**
 * Serverseitige Sessions (ADR-07). Die Session-ID liegt in einem signierten httpOnly-Cookie,
 * die eigentlichen Daten serverseitig. So lassen sich Sessions sauber invalidieren (Logout).
 * Aktuell In-Memory; in Produktion austauschbar gegen einen DB-/persistenten Store.
 */

export interface SessionData {
  userId: string;
}

export interface SessionStore {
  create(userId: string): string;
  get(id: string): SessionData | undefined;
  destroy(id: string): void;
}

export function createMemorySessionStore(): SessionStore {
  const sessions = new Map<string, SessionData>();
  return {
    create(userId) {
      const id = randomBytes(24).toString('hex');
      sessions.set(id, { userId });
      return id;
    },
    get(id) {
      return sessions.get(id);
    },
    destroy(id) {
      sessions.delete(id);
    },
  };
}
