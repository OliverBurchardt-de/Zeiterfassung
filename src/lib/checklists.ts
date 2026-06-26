import type { ArtKey, ChecklistItem } from './types';

/**
 * Checklisten-Vorlagen je Auftragsart.
 *
 * Mechanik (M1): Jede Auftragsart kann ihre eigene Aufgaben-Checkliste haben. Alle Punkte
 * müssen erledigt sein, bevor ein Auftrag auf „Erledigt" gesetzt werden kann (siehe
 * `canComplete` in `state/selectors.ts`). Die konkreten Inhalte je Art legen wir in M2 fest –
 * hier ist FiBu beispielhaft befüllt, JA generisch; die übrigen Arten bleiben vorerst leer.
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

/** Frische Checkliste (alle Punkte offen) aus der Vorlage einer Auftragsart erzeugen. */
export function checklistFor(artKey: ArtKey): ChecklistItem[] {
  return CHECKLIST_TEMPLATES[artKey].map((label) => ({ id: crypto.randomUUID(), label, done: false }));
}
