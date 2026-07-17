import type { OrderView, DatevClient } from '../domain/types';

/**
 * Snapshot = die lokale Kopie der DATEV-Auftrags-/Mandantendaten im laufenden Server
 * (docs/synchronisierung-konzept.md §5). Das Board liest daraus statt live aus DATEV — deshalb
 * ist es sofort da. Gefuellt wird der Snapshot vom Sync-Job (nachts + optional Delta) und, falls
 * er beim ersten Zugriff noch leer ist, einmalig ueber die Lese-Weiche (snapshotDatev.ts).
 *
 * Bewusst nur im Arbeitsspeicher (kein DB-Persist in diesem Ausbau): der Server laeuft durch;
 * nach einem Neustart fuellt ihn das Hochfahren einmal neu. Persistenz in MS SQL ist als spaetere
 * Haertung vorgesehen (Konzept §7).
 */
export interface OrderSnapshotData {
  orders: OrderView[];
  clients: DatevClient[];
  /** Zeitpunkt der letzten erfolgreichen Aktualisierung (ISO). */
  syncedAt: string;
}

export interface OrderSnapshot {
  /** Aktuelle Kopie oder null, solange noch nie erfolgreich synchronisiert wurde. */
  get(): OrderSnapshotData | null;
  set(orders: OrderView[], clients: DatevClient[], syncedAt: string): void;
}

export function createOrderSnapshot(): OrderSnapshot {
  let data: OrderSnapshotData | null = null;
  return {
    get: () => data,
    set: (orders, clients, syncedAt) => {
      data = { orders, clients, syncedAt };
    },
  };
}
