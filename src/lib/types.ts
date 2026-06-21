// Domänenmodell — gemäß design_handoff_zeiterfassung/README.md
import type { StatusId, NoteKind, NoteState, Role } from './tokens';

export type { StatusId, NoteKind, NoteState, Role };

/** Auftragsart-Kürzel für Badge + Farbe */
export type ArtKey = 'ja' | 'ust' | 'lohn' | 'est' | 'fibu';

export interface Comment {
  id: string;
  text: string;
  author: string;
  role: Role;
}

export interface Note {
  id: string;
  text: string;
  author: string;
  kind: NoteKind; // 'frage' = Mitarbeiter, 'review' = Partner
  noteState: NoteState; // offen -> erledigt -> freigegeben
  comments: Comment[];
}

export interface TimeEntry {
  id: string;
  datum: string; // ISO-Datum
  dauer: number; // Stunden (dezimal)
  freigegeben: boolean;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Umplanung {
  zielMonat: string; // z. B. "Apr 2025"
  freigabeAusstehend: boolean;
}

export interface Order {
  id: string;
  mandant: string;
  mandantNr: string;
  auftragsNr: string;
  art: string; // ausgeschriebene Auftragsart (z. B. "Jahresabschluss 2024")
  artKey: ArtKey; // Kürzel/Farbe
  fristStart: string; // ISO
  fristEnde: string; // ISO
  monat: string; // abgeleitet, Anzeige z. B. "Mär 2025"
  soll: number; // Soll-Stunden
  seiten: number; // Ist-Seiten
  kosten: number; // Ist-Kosten in €
  status: StatusId;
  bearbeiter: string;
  bearbeiterId: string;
  partner: string;
  checklist: ChecklistItem[];
  notes: Note[];
  times: TimeEntry[];
  umplanung?: Umplanung | null;
  /** läuft gerade ein Timer auf dieser Karte (Demo-State) */
  timerSec?: number;
  timerRunning?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  initials: string;
}
