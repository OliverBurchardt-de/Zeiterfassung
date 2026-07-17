import type { DatevPort } from '../domain/ports';
import type { OrderSnapshot } from './orderSnapshot';

/** Zielort fuer Log-Zeilen des Syncs — im Betrieb die Konsole, in Tests ein Sammler. */
export type SyncLogger = (message: string) => void;

/**
 * Ein Lese-Sync-Durchlauf (DATEV → App, Konzept §4 Richtung A): holt Auftraege + Mandanten aus
 * DATEV und legt sie in den Snapshot. Faellt der Stammdaten-Abruf aus, bleibt der Sync trotzdem
 * gueltig (Board zeigt dann die clientId) — deshalb `catch → []`. Wirft nur, wenn schon der
 * Auftrags-Abruf scheitert; der Aufrufer (Scheduler/Weiche) faengt das und behaelt den alten
 * Snapshot.
 */
export async function runOrderSync(
  datev: DatevPort,
  snapshot: OrderSnapshot,
  log: SyncLogger,
  nowIso: string
): Promise<{ orders: number; clients: number }> {
  const [orders, clients] = await Promise.all([
    datev.getOrders(),
    datev.getClients().catch(() => []),
  ]);
  snapshot.set(orders, clients, nowIso);
  log(`[Sync] ${orders.length} Auftraege, ${clients.length} Mandanten aktualisiert (${nowIso}).`);
  return { orders: orders.length, clients: clients.length };
}
