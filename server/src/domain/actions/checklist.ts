import type { PublicUser, ChecklistItem } from '../types';
import type { Repositories } from '../ports';
import type { Clock } from '../clock';
import type { RequireVisibleOrder } from './access';
import { DomainError } from '../errors';

/**
 * Checklisten-Aktionen (serverseitig verbindlich). Die Checkliste ist die Grundlage der
 * „Erledigt"-Sperre (canCompleteOrder in status.ts) — deshalb liegt ihre Pflege hier, nicht im
 * Client. Jede Aktion prueft zuerst die Sichtbarkeit des Auftrags (requireVisibleOrder) und dass
 * der Punkt wirklich zu diesem Auftrag gehoert (kein Fremd-Auftrag ueber eine bekannte Punkt-ID).
 *
 * Das automatische Vorbefuellen aus Vorlagen (Ordertype-Katalog/Verwaltung) ist bewusst NICHT hier:
 * es haengt an der serverseitigen Vorlagen-Verwaltung, die als eigener Schritt folgt. Bis dahin
 * pflegt der Nutzer die Punkte manuell (add/remove), was hier persistiert wird.
 */
export function createChecklistActions(repos: Repositories, clock: Clock, requireVisibleOrder: RequireVisibleOrder) {
  /** Laedt den Punkt und stellt sicher, dass er zum genannten Auftrag gehoert. */
  async function itemInOrder(orderId: string, itemId: string): Promise<ChecklistItem> {
    const item = await repos.checklists.findById(itemId);
    if (!item || item.orderId !== orderId) throw new DomainError('not_found', 'Checklistenpunkt nicht gefunden');
    return item;
  }

  return {
    /**
     * Instanziiert die Checkliste eines Auftrags EINMALIG aus Vorlagen-Labels (vom Client, da die
     * Vorlagen dort admin-gepflegt sind). Idempotent: existieren bereits Punkte, bleibt alles
     * unveraendert (kein Doppel-Seed) — auch bei gleichzeitigen Aufrufen der sicherste Fall.
     */
    async ensure(actor: PublicUser, orderId: string, labels: string[]): Promise<ChecklistItem[]> {
      await requireVisibleOrder(actor, orderId);
      const existing = await repos.checklists.listByOrder(orderId);
      if (existing.length > 0) return existing;
      const items: ChecklistItem[] = labels
        .map((l) => l.trim())
        .filter(Boolean)
        .map((label, i) => ({ id: clock.newId(), orderId, label, done: false, position: i }));
      if (items.length) await repos.checklists.insertMany(items);
      return items;
    },

    async add(actor: PublicUser, orderId: string, label: string): Promise<ChecklistItem> {
      await requireVisibleOrder(actor, orderId);
      const trimmed = label.trim();
      if (!trimmed) throw new DomainError('invalid', 'Text darf nicht leer sein');
      const existing = await repos.checklists.listByOrder(orderId);
      const position = existing.length ? Math.max(...existing.map((i) => i.position)) + 1 : 0;
      const item: ChecklistItem = { id: clock.newId(), orderId, label: trimmed, done: false, position };
      await repos.checklists.insert(item);
      return item;
    },

    async setDone(actor: PublicUser, orderId: string, itemId: string, done: boolean): Promise<ChecklistItem> {
      await requireVisibleOrder(actor, orderId);
      const item = await itemInOrder(orderId, itemId);
      if (item.done === done) return item; // idempotent
      await repos.checklists.setDone(itemId, done);
      return { ...item, done };
    },

    async remove(actor: PublicUser, orderId: string, itemId: string): Promise<void> {
      await requireVisibleOrder(actor, orderId);
      await itemInOrder(orderId, itemId);
      await repos.checklists.remove(itemId);
    },
  };
}

export type ChecklistActions = ReturnType<typeof createChecklistActions>;
