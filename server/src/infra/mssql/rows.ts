/**
 * Gemeinsame Helfer fuer DB-Zeile -> Domaene. Reine Funktionen (ohne DB testbar).
 * tedious liefert DATE/DATETIME2 als JS-Date (UTC, s. useUTC in db.ts) — die Domaene
 * arbeitet durchgehend mit ISO-Strings.
 */

/** DATE-Spalte -> "JJJJ-MM-TT". */
export function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/** DATETIME2-Spalte -> ISO-Zeitstempel. */
export function isoDateTime(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Nullable DATETIME2 -> ISO oder undefined. */
export function optionalIsoDateTime(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : isoDateTime(value);
}

/** Nullable NVARCHAR -> string oder undefined. */
export function optionalString(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

/** Nullable INT -> number oder undefined. */
export function optionalNumber(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : Number(value);
}

/** BIT-Spalte -> boolean (tedious liefert je nach Weg true/false oder 1/0). */
export function bit(value: unknown): boolean {
  return value === true || value === 1;
}
