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

export const FREIE_UMPLANUNGEN_PRO_JAHR = 1;

export interface UmplanInput {
  /** Ist der Auftrag bereits einem Monat zugeordnet (also keine Erstplanung)? */
  hasMonat: boolean;
  artKey: string;
  /** Bereits verbrauchte freie Umplanungen im Veranlagungsjahr. */
  verbraucht: number;
}

/** Die „1x pro Jahr frei"-Regel gilt nur fuer Jahresabschluss (ja) und Einkommensteuer (est). */
export function umplanungRegelGilt(artKey: string): boolean {
  return artKey === 'ja' || artKey === 'est';
}

/** Darf ohne Partner-Freigabe umgeplant werden? */
export function umplanungFreiMoeglich(o: UmplanInput): boolean {
  if (!o.hasMonat) return true; // Erstplanung ist immer frei
  if (!umplanungRegelGilt(o.artKey)) return false;
  return (o.verbraucht ?? 0) < FREIE_UMPLANUNGEN_PRO_JAHR;
}
