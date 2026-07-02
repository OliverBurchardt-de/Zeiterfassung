import { randomBytes } from 'node:crypto';

/**
 * Serverseitige Sessions (ADR-07). Die Session-ID liegt in einem signierten httpOnly-Cookie,
 * die eigentlichen Daten serverseitig. So lassen sich Sessions sauber invalidieren (Logout).
 *
 * Jede Session hat eine Lebensdauer (TTL): abgelaufene Sessions sind ungueltig und werden
 * beim Zugriff entfernt — eine gestohlene Session-ID ist damit nicht unbegrenzt gueltig und
 * verwaiste Eintraege (Browser geschlossen ohne Logout) wachsen nicht unbegrenzt an.
 * Aktuell In-Memory; in Produktion austauschbar gegen einen DB-/persistenten Store —
 * die TTL-Semantik gehoert zur Schnittstelle und wandert mit.
 */

export interface SessionData {
  userId: string;
  expiresAt: number;
}

export interface SessionStore {
  create(userId: string): string;
  get(id: string): SessionData | undefined;
  destroy(id: string): void;
}

export function createMemorySessionStore(ttlMs: number = 8 * 60 * 60 * 1000): SessionStore {
  const sessions = new Map<string, SessionData>();

  // Verwaiste (nie wieder angefragte) Sessions periodisch entfernen.
  const sweep = () => {
    const now = Date.now();
    for (const [id, s] of sessions) if (s.expiresAt <= now) sessions.delete(id);
  };
  const iv = setInterval(sweep, Math.min(ttlMs, 15 * 60 * 1000));
  iv.unref?.(); // Prozess-Ende nicht blockieren (Tests)

  return {
    create(userId) {
      const id = randomBytes(24).toString('hex');
      sessions.set(id, { userId, expiresAt: Date.now() + ttlMs });
      return id;
    },
    get(id) {
      const s = sessions.get(id);
      if (!s) return undefined;
      if (s.expiresAt <= Date.now()) {
        sessions.delete(id);
        return undefined;
      }
      return s;
    },
    destroy(id) {
      sessions.delete(id);
    },
  };
}
