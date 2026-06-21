// Domänenmodell — gemäß design_handoff_zeiterfassung/README.md
import type { StatusId, NoteKind, NoteState, Role } from './tokens';

export type { StatusId, NoteKind, NoteState, Role };

/** Auftragsart-Kürzel für Badge + Farbe */
export type ArtKey = 'ja' | 'ust' | 'lohn' | 'est' | 'fibu' | 'beratung' | 'mehraufwand';

export interface Comment {
  id: string;
  text: string;
  author: string;
  role: Role;
}

/** Datei-Anhang an einer Note (Mock: url = Object-URL; im Backend später echte Datei-URL). */
export interface Attachment {
  id: string;
  name: string;
  size: number; // Bytes
  url: string;
}

export interface Note {
  id: string;
  text: string;
  author: string;
  kind: NoteKind; // 'frage' = Mitarbeiter, 'review' = Partner
  noteState: NoteState; // Frage: offen <-> erledigt · Review: offen -> erledigt -> freigegeben
  comments: Comment[];
  attachments: Attachment[];
}

export interface TimeEntry {
  id: string;
  datum: string; // ISO-Datum
  dauer: number; // Stunden (dezimal)
  freigegeben: boolean;
  notiz?: string; // optionale Notiz zur Buchung (Pflicht bei Beratung/Mehraufwand)
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

/**
 * Mandantenbesonderheit — gilt je Mandant + Auftragsart (period-unabhängig) und wird dadurch
 * automatisch auf die Aufträge der Folgeperioden (Jahr/Monat) übernommen.
 */
export interface Besonderheit {
  id: string;
  text: string;
  author: string;
  datum: string; // ISO
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
  art: string; // ausgeschriebene Auftragsart (z. B. "Jahresabschluss")
  artKey: ArtKey; // Kürzel/Farbe
  vj: number; // Veranlagungsjahr (DATEV EO: assessment_year)
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

/**
 * Nutzer der App (Modul „Verwaltung"). Login/Rollen/Rechte liegen in der eigenen App-DB;
 * `datevId` mappt auf die DATEV-Mitarbeiter-ID (`order_responsible*`/`order_partner_id`).
 * Admin ist ein Zusatz-Recht (keine eigene Rolle) und mit jeder Rolle kombinierbar.
 */
export interface User {
  id: string;
  name: string;
  initials: string; // Kürzel
  email: string; // Login + Reminder
  role: Role; // mitarbeiter | partner
  admin: boolean; // Zusatz-Recht: Nutzerverwaltung + Konfiguration
  aktiv: boolean; // deaktiviert statt gelöscht
  datevId: string; // DATEV-Mitarbeiter-ID
  tagessoll: number; // Stunden/Tag
}
