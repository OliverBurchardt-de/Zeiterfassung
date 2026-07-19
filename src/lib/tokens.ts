// Burchardt & Kollegen — Design Tokens (TypeScript)
// Farben/Typo leben als CSS-Variablen in styles/tokens.css; hier nur die
// Status-/Note-Mappings und Rollen-Policies der App.

// Kanban-Status (Reihenfolge = Spaltenreihenfolge)
export type StatusId =
  | 'av' | 'ua' | 'uv' | 'bb' | 'rf' | 'rn' | 'fg' | 'am' | 'fa' | 'er';

export const STATUS: Record<StatusId, { label: string; color: string; soft: string; special?: boolean }> = {
  av: { label: 'Arbeitsvorrat',          color: '#6E6E6E', soft: '#ECEDF0' },
  ua: { label: 'Unterlagen anfordern',   color: '#E94E1B', soft: '#FBE4DB', special: true },
  uv: { label: 'Unterlagen vollständig', color: '#0080C9', soft: '#DCEFF9', special: true },
  bb: { label: 'Bearbeitung begonnen',   color: '#0080C9', soft: '#DCEFF9' },
  rf: { label: 'Reviewfähig',            color: '#F7B234', soft: '#FDEFD2' },
  rn: { label: 'Review Notes',           color: '#E94E1B', soft: '#FBE4DB' },
  fg: { label: 'Freigegeben',            color: '#3A5791', soft: '#E1E6F0' },
  am: { label: 'An Mandant übermittelt', color: '#3A5791', soft: '#E1E6F0' },
  fa: { label: 'Beim FA eingereicht',    color: '#3A5791', soft: '#E1E6F0' },
  er: { label: 'Erledigt',               color: '#2E7D5B', soft: '#DCEDE4' },
};
export const STATUS_ORDER: StatusId[] = ['av','ua','uv','bb','rf','rn','fg','am','fa','er'];

// Review-Note-Typ (kind) + Zustand (noteState)
export type NoteKind = 'frage' | 'review';   // frage = nur Mitarbeiter, review = nur Partner
export const NOTE_KIND: Record<NoteKind, { label: string; color: string; soft: string }> = {
  frage:  { label: 'Frage / Hinweis', color: '#0080C9', soft: '#DCEFF9' },
  review: { label: 'Review Note',     color: '#3A5791', soft: '#E1E6F0' },
};

export type NoteState = 'offen' | 'erledigt' | 'freigegeben';
export const NOTE_STATE: Record<NoteState, { label: string; color: string; soft: string }> = {
  offen:       { label: 'Offen',                          color: '#B5791A', soft: '#FDEFD2' },
  erledigt:    { label: 'Erledigt – wartet auf Freigabe',  color: '#0080C9', soft: '#DCEFF9' },
  freigegeben: { label: 'Freigegeben',                     color: '#2E7D5B', soft: '#DCEDE4' },
};

export type Role = 'mitarbeiter' | 'partner' | 'backoffice';

/** Anzeige-Beschriftung einer Rolle (UI-einheitlich). */
export function roleLabel(role: Role): string {
  return role === 'partner' ? 'Partner' : role === 'backoffice' ? 'Backoffice' : 'Mitarbeiter';
}

// Rollen-Policy für Review Notes / Fragen (durchsetzen, nicht in der UI verstreuen)
//
// Frage  (Mitarbeiter): offen <-> erledigt — KEINE Partner-Freigabe. Der Mitarbeiter
//                        schließt selbst oder stellt eine Rückfrage (Kommentar).
// Review (Partner):      offen -> erledigt (Mitarbeiter meldet) -> freigegeben (Partner gibt frei).
// Bearbeiten/Kommentieren/Anhängen dürfen BEIDE Rollen — dafür braucht es keine Policy-Funktion.
export const notePolicy = {
  canCreateKind: (role: Role): NoteKind => (role === 'partner' ? 'review' : 'frage'),
  // offen -> erledigt: bei Reviews meldet der Mitarbeiter, bei Fragen schließt der Mitarbeiter selbst
  canMarkDone:   (role: Role) => role === 'mitarbeiter',
  // erledigt -> offen für eine Frage (Rückfrage/wieder aufnehmen): Mitarbeiter
  canReopenFrage: (role: Role) => role === 'mitarbeiter',
  // nur Review-Notes durchlaufen eine Partner-Freigabe
  canApprove:    (role: Role, kind: NoteKind) => role === 'partner' && kind === 'review',
  // Review „Zurück an Mitarbeiter" (erledigt -> offen) bzw. freigegebene Review wieder aufnehmen: Partner
  canReturnReview: (role: Role, kind: NoteKind) => role === 'partner' && kind === 'review',
  // Fragen entfernt der Mitarbeiter (Urheber), Review-Notes der Partner
  canDelete:     (role: Role, kind: NoteKind) => (kind === 'frage' ? role === 'mitarbeiter' : role === 'partner'),
};

// Rollen-Policy für Auftrags-/Zeit-Aktionen (zentral durchsetzen, nicht in der UI verstreuen).
//
// Umplanung: der Mitarbeiter fordert die Verschiebung in einen anderen Monat an, der
//            mandatsverantwortliche Partner gibt frei oder lehnt ab.
// Zeiten:    KEINE Partner-Freigabe — der Mitarbeiter gibt seine eigenen Zeiten selbst frei.
export const rolePolicy = {
  canRequestUmplanung: (role: Role) => role === 'mitarbeiter',
  canApproveUmplanung: (role: Role) => role === 'partner',
  canReleaseOwnTime:   (role: Role) => role === 'mitarbeiter' || role === 'backoffice',
  // Bearbeiter zuweisen/ändern: der (mandatsverantwortliche) Partner; Admin zusätzlich via isAdmin.
  canAssignOrder:      (role: Role) => role === 'partner',
  // Zeiten FÜR ANDERE Mitarbeiter buchen: das Backoffice (und der Admin). Serverseitig erzwungen.
  canBookForOthers:    (role: Role, admin: boolean) => role === 'backoffice' || admin,
};
