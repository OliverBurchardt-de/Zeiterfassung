import { heute } from '@/lib/heute';

/** ISO-Datum (YYYY-MM-DD) um n Tage verschieben. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO → deutsches Datum (TT.MM.JJJJ); leer bei ohne Datum. */
export function formatDatumDE(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export interface FristInfo {
  label: string;
  /** Farbton für die Frist-Markierung: rot (überfällig), gelb (heute/bald), normal, grau (ohne). */
  tone: 'overdue' | 'today' | 'soon' | 'normal' | 'none';
}

/**
 * Menschliche Frist-Einordnung relativ zum heutigen Stichtag (heute()):
 * überfällig / heute / morgen / in n Tagen / Datum. Basis für Farbe + Text an der Aufgabe.
 */
export function fristInfo(faelligkeit?: string): FristInfo {
  if (!faelligkeit) return { label: 'ohne Frist', tone: 'none' };
  const h = heute();
  if (faelligkeit < h) return { label: `überfällig (${formatDatumDE(faelligkeit)})`, tone: 'overdue' };
  if (faelligkeit === h) return { label: 'heute fällig', tone: 'today' };
  if (faelligkeit === addDaysISO(h, 1)) return { label: 'morgen fällig', tone: 'soon' };
  // Tagesdifferenz für „in n Tagen" (bis eine Woche), sonst Datum.
  const diffTage = Math.round((new Date(faelligkeit + 'T00:00:00').getTime() - new Date(h + 'T00:00:00').getTime()) / 86_400_000);
  if (diffTage <= 7) return { label: `in ${diffTage} Tagen`, tone: 'soon' };
  return { label: `fällig ${formatDatumDE(faelligkeit)}`, tone: 'normal' };
}
