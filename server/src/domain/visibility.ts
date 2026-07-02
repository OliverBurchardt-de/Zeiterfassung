import type { OrderView, PublicUser } from './types';

/**
 * Sichtbarkeit von Auftraegen je Nutzer (serverseitig durchgesetzt — verbindliche Instanz, ADR-02).
 * Interne Auftragsarten gehoeren nie ins Board.
 * - Admin: alle Board-Auftraege.
 * - Partner: nur seine verantworteten Mandate (+ eigene Bearbeitung) — NICHT alle Mandate
 *   (Regel wie im Frontend `sichtbareAuftraege`; Review-Befund: Server war grosszuegiger).
 * - Mitarbeiter: nur Auftraege, bei denen er Bearbeiter ist.
 */
export function visibleOrders(orders: OrderView[], user: PublicUser): OrderView[] {
  const board = orders.filter((o) => !o.isInternal);
  if (user.admin) return board;
  if (user.role === 'partner') return board.filter((o) => o.partnerId === user.id || o.responsibleId === user.id);
  return board.filter((o) => o.responsibleId === user.id);
}
