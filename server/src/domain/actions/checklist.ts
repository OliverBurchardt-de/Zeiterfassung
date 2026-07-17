import type { PublicUser, ChecklistItem } from '../types';
import type { Repositories } from '../ports';
import type { Clock } from '../clock';
import type { RequireVisibleOrder } from './access';
import { DomainError } from '../errors';
import { LIMITS } from '../limits';
import { defaultChecklistLabels } from '../checklistTemplates';

/**
 * Checklisten-Aktionen (serverseitig verbindlich). Die Checkliste ist die Grundlage der
 * „Erledigt"-Sperre (canCompleteOrder in status.ts) — deshalb liegt ihre Pflege hier, nicht im
 * Client. Jede Aktion prueft zuerst die Sichtbarkeit des Auftrags (requireVisibleOrder) und dass
 * der Punkt wirklich zu diesem Auftrag gehoert (kein Fremd-Auftrag ueber eine bekannte Punkt-ID).
 */

/**
 * Stellt die serverseitig definierten PFLICHTPUNKTE eines Ordertypes sicher (Review 17.07., P1-1).
 *
 * Frueher konnte der Client beim ersten `ensure` beliebige (auch verkuerzte) Labels als
 * Pflichtvorlage schicken, oder vorab einen trivialen manuellen Punkt anlegen — sobald IRGENDein
 * Punkt existierte, unterblieb das Seeding und das „Erledigt"-Gate war umgehbar. Jetzt gilt:
 *  - Die Pflichtvorlage kommt AUSSCHLIESSLICH serverseitig aus `defaultChecklistLabels` (nie vom
 *    Browser).
 *  - Fehlende Pflichtpunkte werden ergaenzt, AUCH wenn bereits (manuelle) Punkte existieren —
 *    ein vorab angelegter manueller Punkt kann das Seeding nicht mehr verhindern.
 *  - Abgeglichen wird gegen die vorhandenen 'vorlage'-Punkte (fehlende Herkunft gilt fail-safe als
 *    'vorlage'); ein manueller Punkt mit gleichem Text zaehlt NICHT als Pflichtpunkt.
 * Idempotent und auch bei gleichzeitigen Aufrufen sicher (schlimmstenfalls ein zweiter Punkt mit
 * gleichem Label — nie ein FEHLENDER Pflichtpunkt).
 */
export async function seedMandatoryChecklist(
  repos: Repositories,
  clock: Clock,
  orderId: string,
  ordertype: string
): Promise<ChecklistItem[]> {
  const pflichtLabels = defaultChecklistLabels(ordertype);
  const existing = await repos.checklists.listByOrder(orderId);
  if (pflichtLabels.length === 0) return existing;
  const vorhandeneVorlagen = new Set(
    existing.filter((i) => (i.herkunft ?? 'vorlage') === 'vorlage').map((i) => i.label)
  );
  const fehlende = pflichtLabels.filter((l) => !vorhandeneVorlagen.has(l));
  if (fehlende.length === 0) return existing;
  const basePos = existing.length ? Math.max(...existing.map((i) => i.position)) + 1 : 0;
  // Pflichtpunkte: herkunft 'vorlage' -> nie loeschbar (Review 12.07., P1.2).
  const neu: ChecklistItem[] = fehlende.map((label, i) => ({
    id: clock.newId(), orderId, label, done: false, position: basePos + i, herkunft: 'vorlage' as const,
  }));
  await repos.checklists.insertMany(neu);
  return [...existing, ...neu];
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
     * Stellt die serverseitigen PFLICHTPUNKTE des Auftrags sicher (Review P1-1). Die frueher
     * uebergebenen Client-Labels sind NICHT mehr die Pflichtvorlage — die Pflicht kommt allein aus
     * dem Server-Katalog (`seedMandatoryChecklist`). Der `_labels`-Parameter bleibt aus
     * Kompatibilitaet erhalten, wird aber bewusst ignoriert (admin-gepflegte Vorlagen bekommen
     * spaeter eine eigene, autorisierte Server-API).
     */
    async ensure(actor: PublicUser, orderId: string, _labels: string[]): Promise<ChecklistItem[]> {
      const order = await requireVisibleOrder(actor, orderId);
      return seedMandatoryChecklist(repos, clock, orderId, order.ordertype);
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
