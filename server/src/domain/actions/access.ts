import type { DatevPort } from '../ports';
import type { PublicUser, OrderView } from '../types';
import { DomainError } from '../errors';
import { canAccessOrder } from '../visibility';

/**
 * Auftrags-Zugriffs-Guard für die Fach-Aktionen. Lädt den Auftrag über den DATEV-Port und
 * erzwingt `canAccessOrder` — die serverseitig verbindliche Sichtbarkeitsregel. OHNE diesen
 * Guard prüfen die Aktionen nur „eingeloggt?", nicht „darf diesen Auftrag sehen?" (Review-Befund:
 * IDOR über durchnummerierbare DATEV-Auftrags-IDs).
 *
 * Bewusst **404 auch bei fehlendem Zugriff** (nicht 403): So verrät die API nicht, ob eine
 * Auftrags-ID existiert — kein Enumerations-Orakel für fremde Mandate.
 */
export type RequireVisibleOrder = (actor: PublicUser, orderId: string) => Promise<OrderView>;

export function createOrderAccess(datev: DatevPort): RequireVisibleOrder {
  return async (actor, orderId) => {
    const order = await datev.getOrder(orderId);
    if (!order || !canAccessOrder(order, actor)) {
      throw new DomainError('not_found', 'Auftrag nicht gefunden oder kein Zugriff');
    }
    return order;
  };
}
