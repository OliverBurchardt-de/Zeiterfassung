import type { DatevPort } from '../domain/ports';
import type { OrderSnapshot } from './orderSnapshot';
import { runOrderSync, type SyncLogger } from './syncOrders';

/**
 * Lese-Weiche (Konzept §5): ein DatevPort, der beim Lesen zuerst in den Snapshot schaut und nur
 * bei leerem Snapshot einmalig live nachlaedt (und dabei fuellt). So triggert das Board nie selbst
 * den langsamen Live-Abruf — im Normalbetrieb hat der Scheduler den Snapshot laengst gefuellt.
 *
 * Schreiben (postExpensePosting) und der Gesundheits-Ping gehen unveraendert an den echten Adapter.
 * `getOrder(id)` bedient sich aus dem Snapshot; ist ein Auftrag dort nicht enthalten (z. B. durch
 * einen Auftragsfilter), faellt es gezielt auf den Live-Einzelabruf zurueck.
 */
export function createSnapshotBackedDatev(
  raw: DatevPort,
  snapshot: OrderSnapshot,
  log: SyncLogger,
  nowIso: () => string
): DatevPort {
  // Verhindert, dass gleichzeitige Board-Zugriffe (getOrders + getClients laufen parallel) den
  // teuren Erst-Abruf doppelt ausloesen: der zweite wartet auf denselben laufenden Sync.
  let inflight: Promise<void> | null = null;

  async function ensureFilled(): Promise<void> {
    if (snapshot.get()) return;
    if (!inflight) {
      inflight = runOrderSync(raw, snapshot, log, nowIso())
        .then(() => undefined)
        .finally(() => {
          inflight = null;
        });
    }
    await inflight;
  }

  return {
    health: () => raw.health(),
    async getOrders() {
      await ensureFilled();
      return snapshot.get()?.orders ?? [];
    },
    async getOrder(id) {
      await ensureFilled();
      const fromSnapshot = snapshot.get()?.orders.find((o) => o.id === id);
      return fromSnapshot ?? raw.getOrder(id);
    },
    async getClients() {
      await ensureFilled();
      return snapshot.get()?.clients ?? [];
    },
    postExpensePosting: (p) => raw.postExpensePosting(p),
  };
}
