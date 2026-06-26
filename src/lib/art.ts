import type { ArtKey, Aufwandsart, TimeStatus } from './types';

/** Label + Badge-Klasse je Zeit-Status (zentral, damit alle Zeit-Ansichten gleich aussehen). */
export const TIME_STATUS: Record<TimeStatus, { label: string; badge: string }> = {
  erfasst: { label: 'Erfasst', badge: 'badge--notok' },
  freigegeben: { label: 'Freigegeben', badge: 'badge--ok' },
  uebertragen: { label: 'Übertragen', badge: 'badge--ok' },
};

/** Kürzel + Farbe je Auftragsart (Farben aus tokens.css `--bk-art-*`, keine Hardcode-Hex). */
export const ART: Record<ArtKey, { label: string; color: string }> = {
  fibu: { label: 'FIBU', color: 'var(--bk-art-fibu)' },
  lohn: { label: 'LOHN', color: 'var(--bk-art-lohn)' },
  ja: { label: 'JA', color: 'var(--bk-art-ja)' },
  est: { label: 'ESt', color: 'var(--bk-art-est)' },
  beratung: { label: 'STB', color: 'var(--bk-art-beratung)' },
  wirtschaft: { label: 'WB', color: 'var(--bk-art-wirtschaft)' },
  hausverwaltung: { label: 'HV', color: 'var(--bk-art-hausverwaltung)' },
  vorbehalt: { label: 'VBA', color: 'var(--bk-art-vorbehalt)' },
  lfd_beratung: { label: 'lfd. StB', color: 'var(--bk-art-lfd-beratung)' },
  mehraufwand: { label: 'MEHR', color: 'var(--bk-art-mehraufwand)' },
};

/** Auftragsarten mit Unterlagen-Prozess → Spalten ua/uv sichtbar */
export const ARTEN_MIT_UNTERLAGEN: ArtKey[] = ['ja', 'fibu'];

export function hasUnterlagenProzess(artKey: ArtKey): boolean {
  return ARTEN_MIT_UNTERLAGEN.includes(artKey);
}

/** Auftragsarten, bei denen jede Zeitbuchung eine Pflicht-Notiz braucht (die laufenden Container) */
export const ARTEN_MIT_PFLICHT_NOTIZ: ArtKey[] = ['lfd_beratung', 'mehraufwand'];

export function artNeedsNotiz(artKey: ArtKey): boolean {
  return ARTEN_MIT_PFLICHT_NOTIZ.includes(artKey);
}

/** Auftragsarten mit „Besonderheiten"-Button (Mandantenbesonderheiten je Art) */
export const BESONDERHEITEN_ARTEN: ArtKey[] = ['fibu', 'lohn', 'ja', 'est'];

export function hasBesonderheiten(artKey: ArtKey): boolean {
  return BESONDERHEITEN_ARTEN.includes(artKey);
}

/**
 * „Laufende" Auftragsarten: kein Status-Flow / keine Planung, sondern dauerhafte
 * Buchungs-Container pro Mandant (Modul „Laufende Buchungen", nicht im Kanban-Board).
 */
export const LAUFENDE_ARTEN: ArtKey[] = ['lfd_beratung', 'mehraufwand'];

export function isLaufendeArt(artKey: ArtKey): boolean {
  return LAUFENDE_ARTEN.includes(artKey);
}

/**
 * Aufwandsarten hinter „Mehraufwand / Dumm gelaufen". Pro Buchung wählbar; mappt in M2 auf die
 * Aufwandsarten in DATEV EO Comfort (Aufwandsbuchung via `POST …/expensepostings`).
 */
export const AUFWANDSARTEN: { key: Aufwandsart; label: string }[] = [
  { key: 'mehraufwand', label: 'Mehraufwand' },
  { key: 'dumm', label: 'Dumm gelaufen' },
];

/** Braucht diese Auftragsart die Auswahl der Aufwandsart je Buchung? (nur Mehraufwand/Dumm gelaufen) */
export function needsAufwandsart(artKey: ArtKey): boolean {
  return artKey === 'mehraufwand';
}

/** Auftragsarten mit Monats-Teilaufträgen (Suborder-Ebene in DATEV): FiBu & Lohn */
export const TEILAUFTRAG_ARTEN: ArtKey[] = ['fibu', 'lohn'];

export function hasTeilauftraege(artKey: ArtKey): boolean {
  return TEILAUFTRAG_ARTEN.includes(artKey);
}

/** Stunden dezimal → "X,X h" (de-DE) */
export function formatHours(h: number): string {
  return `${h.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

/** Sekunden → "mm:ss" */
export function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Euro-Betrag → "1.840 €" */
export function formatEuro(v: number): string {
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
}

/** Summe der erfassten Stunden eines Auftrags */
export function erfassteStunden(times: { dauer: number }[]): number {
  return times.reduce((sum, t) => sum + t.dauer, 0);
}
