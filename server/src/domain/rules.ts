/**
 * Reine Fachregeln (ohne DB/DATEV) — leicht testbar (ADR-10). Spiegelt die im Frontend
 * (M1) bereits getesteten Selektoren; in M2 ist DIESE Server-Variante verbindlich.
 */

export interface ChecklistItem {
  done: boolean;
}

/** „Erledigt" ist erst moeglich, wenn die Checkliste vollstaendig ist. */
export function canCompleteOrder(items: ChecklistItem[]): boolean {
  return items.every((i) => i.done);
}

/** Eine Zeitbuchung braucht eine positive Dauer. */
export function isValidTimeDuration(hours: number): boolean {
  return Number.isFinite(hours) && hours > 0;
}

// Die Umplanungs-Regeln (1x/Jahr frei fuer JA/ESt) kommen mit der Umplanungs-Aktion
// (Etappe 3) hierher — Vorlage: src/lib/regeln.ts im Frontend.
