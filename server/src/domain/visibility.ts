import type { OrderView, PublicUser } from './types';

/**
 * Darf ein Nutzer DIESEN Auftrag sehen/bearbeiten? Einzige verbindliche Instanz (ADR-02) — jede
 * auftragsbezogene Aktion/Route MUSS hierueber gehen (nicht nur die Board-Liste).
 * Interne Auftragsarten gehoeren nie ins Board (auch nicht fuer Admin).
 * - Admin: alle Board-Auftraege.
 * - Partner: nur seine verantworteten Mandate (+ eigene Bearbeitung) — NICHT alle Mandate
 *   (Regel wie im Frontend `sichtbareAuftraege`; Review-Befund: Server war grosszuegiger).
 * - Mitarbeiter: nur Auftraege, bei denen er Bearbeiter ist.
 */
export function canAccessOrder(order: OrderView, user: PublicUser): boolean {
  if (order.isInternal) return false;
  if (user.admin) return true;
  if (user.role === 'partner') return order.partnerId === user.id || order.responsibleId === user.id;
  return order.responsibleId === user.id;
}

/** Board-Liste eines Nutzers — Filter ueber dasselbe Ein-Auftrag-Praedikat. */
export function visibleOrders(orders: OrderView[], user: PublicUser): OrderView[] {
  return orders.filter((o) => canAccessOrder(o, user));
}
