// Burchardt & Kollegen — Design Tokens (TypeScript)
// Spiegelt design-tokens.css. Für Status/Auftragsart-Mappings in der App.

export const colors = {
  anthracite: '#333333',
  blue: '#0080C9',
  deepBlue: '#3A5791',
  amber: '#F7B234',
  amberHover: '#E5A11C',
  bloodOrange: '#E94E1B',
  success: '#2E7D5B',
  fg1: '#333333',
  fg2: '#6E6E6E',
  fg3: '#9AA0AB',
  paper: '#FAFAF8',
  cloud: '#F2F4F8',
  stone: '#E5E7EC',
  box: '#D4D9E2',
  white: '#FFFFFF',
  blueSoft: '#DCEFF9',
  deepSoft: '#E1E6F0',
  amberSoft: '#FDEFD2',
  orangeSoft: '#FBE4DB',
  successSoft: '#DCEDE4',
  amberText: '#7A5400',
  amberInk: '#B5791A',
} as const;

export const fonts = {
  display: "'Petrona', Cambria, Georgia, serif",
  body: "'Aleo', 'Helvetica Neue', Arial, sans-serif",
} as const;

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

export type Role = 'mitarbeiter' | 'partner';

// Rollen-Policy für Review Notes (durchsetzen, nicht in der UI verstreuen)
export const notePolicy = {
  canCreateKind: (role: Role): NoteKind => (role === 'partner' ? 'review' : 'frage'),
  canEditText:   (_role: Role) => true,
  canComment:    (_role: Role) => true,
  canMarkDone:   (role: Role) => role === 'mitarbeiter',  // offen -> erledigt
  canApprove:    (role: Role) => role === 'partner',      // -> freigegeben
  canDelete:     (role: Role) => role === 'partner',
};
