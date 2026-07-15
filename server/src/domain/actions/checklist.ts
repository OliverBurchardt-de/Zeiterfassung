import type { PublicUser, ChecklistItem } from '../types';
import type { Repositories } from '../ports';
import type { Clock } from '../clock';
import type { RequireVisibleOrder } from './access';
import { DomainError } from '../errors';
import { LIMITS } from '../limits';

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

/**
 * Instanziiert die Checkliste eines Auftrags EINMALIG aus Vorlagen-Labels. Idempotent: existieren
 * bereits Punkte, bleibt alles unveraendert (kein Doppel-Seed) — auch bei gleichzeitigen Aufrufen
 * der sicherste Fall. Gemeinsame Mechanik von `ensure` (Client-Vorlagen beim ersten Oeffnen) und
 * dem „Erledigt"-Gate in status.ts (Server-Default-Vorlage vor der Gate-Pruefung).
 */
export async function seedChecklist(
  repos: Repositories,
  clock: Clock,
  orderId: string,
  labels: string[]
): Promise<ChecklistItem[]> {
  const existing = await repos.checklists.listByOrder(orderId);
  if (existing.length > 0) return existing;
  // Vorlagen-Punkte sind Pflichtpunkte: herkunft 'vorlage' -> nie loeschbar (Review 12.07., P1.2).
  const items: ChecklistItem[] = labels
    .map((l) => l.trim())
    .filter(Boolean)
    .map((label, i) => ({ id: clock.newId(), orderId, label, done: false, position: i, herkunft: 'vorlage' as const }));
  if (items.length) await repos.checklists.insertMany(items);
  return items;
}

export function createChecklistActions(repos: Repositories, clock: Clock, requireVisibleOrder: RequireVisibleOrder) {
  /** Laedt den Punkt und stellt sicher, dass er zum genannten Auftrag gehoert. */
  async function itemInOrder(orderId: string, itemId: string): Promise<ChecklistItem> {
    const item = await repos.checklists.findById(itemId);
    if (!item || item.orderId !== orderId) throw new DomainError('not_found', 'Checklistenpunkt nicht gefunden');
    return item;
  }

  return {
    /**
     * Checkliste einmalig aus Client-Vorlagen-Labels instanziieren (die Vorlagen sind dort
     * admin-gepflegt) — Mechanik und Idempotenz siehe `seedChecklist`.
     */
    async ensure(actor: PublicUser, orderId: string, labels: string[]): Promise<ChecklistItem[]> {
      await requireVisibleOrder(actor, orderId);
      // Jedes einzelne Label pruefen (Review P2.4): Laenge passend zum DB-Schema; leere Labels
      // filtert der Seed bewusst heraus (Vorlagen duerfen Luecken enthalten).
      for (const label of labels) {
        if (label.trim().length > LIMITS.LABEL_MAX) {
          throw new DomainError('invalid', `Checklisten-Label ist zu lang (max. ${LIMITS.LABEL_MAX} Zeichen)`);
        }
      }
      return seedChecklist(repos, clock, orderId, labels);
    },

    async add(actor: PublicUser, orderId: string, label: string): Promise<ChecklistItem> {
      await requireVisibleOrder(actor, orderId);
      const trimmed = label.trim();
      if (!trimmed) throw new DomainError('invalid', 'Text darf nicht leer sein');
      if (trimmed.length > LIMITS.LABEL_MAX) {
        throw new DomainError('invalid', `Checklisten-Label ist zu lang (max. ${LIMITS.LABEL_MAX} Zeichen)`);
      }
      const existing = await repos.checklists.listByOrder(orderId);
      const position = existing.length ? Math.max(...existing.map((i) => i.position)) + 1 : 0;
      // Am Auftrag ergaenzte Punkte sind 'manuell' -> loeschbar (als Soft-Delete).
      const item: ChecklistItem = { id: clock.newId(), orderId, label: trimmed, done: false, position, herkunft: 'manuell' };
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

    /**
     * Loeschen (Review 12.07.2026, P1.2+P1.3): Pflichtpunkte aus der Vorlage sind NIE loeschbar
     * (sonst waere das „Erledigt"-Gate umgehbar). Manuelle Punkte werden soft-geloescht — Inhalt,
     * Auftrag, Loeschender und Zeitpunkt bleiben revisionssicher erhalten; Wer/Wann setzt der
     * Server, nie der Client.
     */
    async remove(actor: PublicUser, orderId: string, itemId: string): Promise<void> {
      await requireVisibleOrder(actor, orderId);
      const item = await itemInOrder(orderId, itemId);
      if (item.deletedAt) return; // bereits geloescht — idempotent
      if (item.herkunft === 'vorlage') {
        throw new DomainError('conflict', 'Pflichtpunkt aus der Vorlage kann nicht geloescht werden');
      }
      await repos.checklists.softDelete(itemId, actor.id, clock.now());
    },
  };
}

export type ChecklistActions = ReturnType<typeof createChecklistActions>;
