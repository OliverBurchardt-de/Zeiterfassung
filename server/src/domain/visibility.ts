import type { OrderView, PublicUser } from './types';

/**
 * Sichtbarkeit von Auftraegen je Nutzer (serverseitig durchgesetzt).
 * Interne Auftragsarten gehoeren nie ins Board. Mitarbeiter sehen nur eigene;
 * Partner und Admin sehen alle (Board-)Auftraege.
 */
export function visibleOrders(orders: OrderView[], user: PublicUser): OrderView[] {
  const board = orders.filter((o) => !o.isInternal);
  if (user.admin || user.role === 'partner') return board;
  return board.filter((o) => o.responsibleId === user.id);
}
