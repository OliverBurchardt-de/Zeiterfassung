import type { OrderView, PublicUser } from './types';

/**
 * Darf ein Nutzer DIESEN Auftrag sehen/bearbeiten? Einzige verbindliche Instanz (ADR-02) — jede
 * auftragsbezogene Aktion/Route MUSS hierueber gehen (nicht nur die Board-Liste).
 * Interne Auftragsarten gehoeren nie ins Board (auch nicht fuer Admin).
 * - Admin: alle Board-Auftraege.
 * - Partner: nur seine verantworteten Mandate (+ eigene Bearbeitung) — NICHT alle Mandate
 *   (Regel wie im Frontend `sichtbareAuftraege`; Review-Befund: Server war grosszuegiger).
 * - Mitarbeiter: nur Auftraege, bei denen er Bearbeiter ist.
 *
 * WICHTIG: `order.responsibleId`/`partnerId` sind **DATEV-Mitarbeiter-IDs** (order_responsible1_id /
 * order_partner_id), NICHT die internen App-User-IDs. Der Abgleich laeuft daher ueber die am Nutzer
 * hinterlegte `datevEmployeeId` (Mapping App<->DATEV). Ohne gesetzte `datevEmployeeId` sieht ein
 * Nicht-Admin bewusst NICHTS (fail-closed) — im Mock stimmen App-ID und DATEV-ID nicht ueberein,
 * damit dieser Abgleich verifizierbar ist (Codex-Review P1).
 */
export function canAccessOrder(order: OrderView, user: PublicUser): boolean {
  // Interne Auftraege (z. B. Kanzleiverwaltung 9801) sind firmenweit BEBUCHBAR — jeder angemeldete
  // Nutzer darf darauf Zeit erfassen (nur nicht im Board, s. visibleOrders). Entscheidung 19.07.2026.
  if (order.isInternal) return true;
  if (user.admin) return true;
  // Backoffice erfasst/bucht fuer ALLE Mitarbeiter -> sieht alle (Board-)Auftraege.
  if (user.role === 'backoffice') return true;
  const datevId = user.datevEmployeeId;
  if (!datevId) return false;
  if (user.role === 'partner') return order.partnerId === datevId || order.responsibleId === datevId;
  return order.responsibleId === datevId;
}

/**
 * Board-Liste eines Nutzers. Interne Auftraege gehoeren NIE ins Board (auch nicht fuer Admin),
 * obwohl sie bebuchbar sind (canAccessOrder) — deshalb hier zusaetzlich herausfiltern.
 */
export function visibleOrders(orders: OrderView[], user: PublicUser): OrderView[] {
  return orders.filter((o) => !o.isInternal && canAccessOrder(o, user));
}
