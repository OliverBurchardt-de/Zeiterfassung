import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../plugins/auth';
import type { Actions } from '../domain/actions';

/**
 * Board-Aggregat fuers Frontend: sichtbare Auftraege inkl. Overlay (Feinstatus),
 * Zeiten, Notes (mit Kommentaren) und Checkliste in einer Antwort — spart dem
 * Client N+1-Anfragen beim Laden des Boards.
 */
export function boardRoutes(app: FastifyInstance, actions: Actions): void {
  app.get('/api/board', { preHandler: requireAuth }, async (req) => actions.board.list(req.currentUser!));
}
