import type { ArtKey, ChecklistItem } from './types';
import { ORDERTYPES, artKeyForOrdertype } from './ordertypes';

/**
 * Checklisten-Vorlagen je grobem Bucket (ArtKey) — dient nur noch als **Default-Quelle** für die
 * ordertype-genauen Vorlagen unten. Gepflegt wird je konkreter Auftragsart (Ordertype) in der
 * Verwaltung (Store, persistiert); in M2 aus der App-DB.
 *
 * Mechanik: Alle Punkte einer Checkliste müssen erledigt sein, bevor ein Auftrag auf „Erledigt"
 * gesetzt werden kann (siehe `canComplete` in `state/selectors.ts`).
 */
export const CHECKLIST_TEMPLATES: Record<ArtKey, string[]> = {
  fibu: ['Personalaufwand abgestimmt', 'USt gebucht', 'AfA gebucht', 'BWA übermittelt'],
  ja: ['Summen- & Saldenliste geprüft', 'Kontennachweise vollständig', 'Anlagenverzeichnis abgestimmt'],
  lohn: [],
  est: [],
  beratung: [],
  wirtschaft: [],
  hausverwaltung: [],
  vorbehalt: [],
  lfd_beratung: [],
  mehraufwand: [],
};

/** Frische Checkliste (alle Punkte offen) aus der Bucket-Vorlage einer Auftragsart erzeugen. */
export function checklistFor(artKey: ArtKey): ChecklistItem[] {
  return checklistFromTemplate(CHECKLIST_TEMPLATES[artKey]);
}

/**
 * Default-Checklisten je **konkreter Auftragsart** (Ordertype). Erbt anfangs die Bucket-Vorlage;
 * ab hier wird ordertype-genau gepflegt (in der Verwaltung, Store-persistiert). In M2 nutzt der
 * DATEV-Import diese Vorlagen pro Ordertype.
 */
export const CHECKLIST_TEMPLATES_BY_ORDERTYPE: Record<string, string[]> = Object.fromEntries(
  ORDERTYPES.map((ot) => {
    const ak = artKeyForOrdertype(ot.ordertype, ot.groupId);
    return [ot.ordertype, ak ? [...CHECKLIST_TEMPLATES[ak]] : []];
  }),
);

/** Frische Checkliste (alle Punkte offen) aus einer Vorlagen-Liste erzeugen. */
function checklistFromTemplate(items: string[]): ChecklistItem[] {
  // Vorlagen-Punkte sind Pflichtpunkte ('vorlage') — nicht löschbar, wie serverseitig.
  return items.map((label) => ({ id: crypto.randomUUID(), label, done: false, herkunft: 'vorlage' as const }));
}
