/**
 * Zentrale Eingabegrenzen (Review 12.07.2026, P2.4) — EINE Quelle fuer Domain, Routen und
 * DB-Schema. Die API lehnt Verstoesse mit 400 ab, BEVOR ein Datenbankfehler entsteht.
 *
 * Einordnung der Werte:
 * - LABEL_MAX spiegelt das DB-Schema (checklist_items.label NVARCHAR(500)).
 * - TEXT_MAX (Notes/Kommentare/Zeitnotizen): DB ist NVARCHAR(MAX); 4000 Zeichen sind eine
 *   grosszuegige technische Obergrenze gegen Missbrauch/Versehen — kein Fachlimit.
 * - DAUER_MAX_STUNDEN = 24 ist die physikalische Obergrenze eines Arbeitstags (work_date-
 *   bezogen), bewusst grosszuegig. Eine engere Kanzlei-Regel (z. B. 12 h) waere eine
 *   FACHLICHE Entscheidung — bei Bedarf hier zentral aendern.
 * - DAUER_SCHRITT = 0.01 h passt zur DB (DECIMAL(9,2)); feinere Werte gingen verloren.
 */
export const LIMITS = {
  /** Max. Dauer einer einzelnen Zeitbuchung in Stunden (physikalische Tagesgrenze). */
  DAUER_MAX_STUNDEN: 24,
  /** Max. Nachkommastellen der Dauer (DB: DECIMAL(9,2)). */
  DAUER_NACHKOMMASTELLEN: 2,
  /** Checklisten-Label (DB: NVARCHAR(500)). */
  LABEL_MAX: 500,
  /** Freitexte: Note-/Kommentar-Text, Zeit-Notiz. */
  TEXT_MAX: 4000,
  /** Board-Position: nicht negativ, ganzzahlig, mit grosszuegiger Obergrenze. */
  BOARD_POSITION_MAX: 100000,
  /** Max. Vorlagen-Labels je checklist/ensure-Aufruf. */
  ENSURE_LABELS_MAX: 200,
} as const;

/**
 * Echte Kalenderpruefung fuer "JJJJ-MM-TT" (nicht nur Format): 2026-02-30 ist ungueltig.
 * Vergleich ueber UTC-Roundtrip — Date normalisiert ungueltige Tage (30.02. -> 02.03.).
 */
export function isValidIsoDate(datum: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return false;
  const d = new Date(`${datum}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === datum;
}

/** Dauer einer Zeitbuchung: > 0, hoechstens ein Tag, maximal 2 Nachkommastellen. */
export function isValidDauer(stunden: number): boolean {
  if (!Number.isFinite(stunden) || stunden <= 0 || stunden > LIMITS.DAUER_MAX_STUNDEN) return false;
  const skaliert = stunden * 10 ** LIMITS.DAUER_NACHKOMMASTELLEN;
  return Math.abs(skaliert - Math.round(skaliert)) < 1e-9;
}
