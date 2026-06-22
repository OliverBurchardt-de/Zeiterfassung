/** Hilfsfunktionen rund um den Anzeige-Monat (z. B. „Mär 2025"). */

const MONAT_ABBR = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export interface ParsedMonat {
  year: number;
  monthIndex: number; // 0 = Januar
}

/** „Mär 2025" → { year: 2025, monthIndex: 2 } (oder null bei unbekanntem Format). */
export function parseMonat(s: string): ParsedMonat | null {
  const [abbr, yearStr] = s.split(' ');
  const monthIndex = MONAT_ABBR.indexOf(abbr);
  const year = Number(yearStr);
  if (monthIndex < 0 || Number.isNaN(year)) return null;
  return { year, monthIndex };
}

/** Sortierschlüssel für chronologische Reihenfolge der Monate. */
export function monatSortKey(s: string): number {
  const p = parseMonat(s);
  return p ? p.year * 100 + p.monthIndex : 0;
}

/** Anzahl Arbeitstage (Mo–Fr) im Monat — Mock-Kapazitätsbasis (ohne Feiertage/Urlaub). */
export function arbeitstage(s: string): number {
  const p = parseMonat(s);
  if (!p) return 0;
  const tageImMonat = new Date(p.year, p.monthIndex + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= tageImMonat; d++) {
    const wd = new Date(p.year, p.monthIndex, d).getDay();
    if (wd >= 1 && wd <= 5) count++;
  }
  return count;
}

/** Eindeutige, chronologisch sortierte Monatsliste aus beliebigen Monats-Strings. */
export function uniqueMonate(monate: string[]): string[] {
  return Array.from(new Set(monate)).sort((a, b) => monatSortKey(a) - monatSortKey(b));
}

/** „Mär 2025" aus Jahr + Monatsindex. */
export function monatLabel(year: number, monthIndex: number): string {
  return `${MONAT_ABBR[monthIndex]} ${year}`;
}

/** Fortlaufende Monatsliste ab (year, monthIndex), `count` Monate lang. */
export function monthRange(year: number, monthIndex: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(year, monthIndex + i, 1);
    out.push(monatLabel(d.getFullYear(), d.getMonth()));
  }
  return out;
}

/** Erster und letzter Tag (ISO) eines Monats-Strings — für Auftrags-Start/-Ende beim Einplanen. */
export function monatBounds(s: string): { start: string; end: string } | null {
  const p = parseMonat(s);
  if (!p) return null;
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: iso(new Date(p.year, p.monthIndex, 1)), end: iso(new Date(p.year, p.monthIndex + 1, 0)) };
}
