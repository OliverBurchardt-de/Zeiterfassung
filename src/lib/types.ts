// Domänenmodell — gemäß design_handoff_zeiterfassung/README.md
import type { StatusId, NoteKind, NoteState, Role } from './tokens';

export type { StatusId, NoteKind, NoteState, Role };

/**
 * Grober Farb-/Workflow-**Bucket** (Badge-Kürzel + Board-Farbe) — NICHT die Auftragsidentität (das ist
 * der `ordertype`). Bildet die DATEV-Auftragsartengruppen (Live-Katalog Burchardt & Kollegen) ab;
 * `lfd_beratung`/`mehraufwand` sind die ordertype-genauen „laufend"-Container (aus den Gruppen
 * Steuerliche Beratung bzw. FiBu/Lohn herausgelöst). Ableitung aus dem Ordertype in `src/lib/ordertypes.ts`.
 */
export type ArtKey =
  | 'fibu' | 'lohn' | 'ja' | 'est' | 'beratung'
  | 'wirtschaft' | 'hausverwaltung' | 'vorbehalt'
  | 'mehraufwand' | 'lfd_beratung';

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

/** Aufwandsart hinter „Mehraufwand / Dumm gelaufen" — mappt auf Aufwandsarten in DATEV EO Comfort. */
export type Aufwandsart = 'mehraufwand' | 'dumm';

/**
 * Lebenszyklus eines Zeiteintrags (keine Partner-Freigabe!):
 *  erfasst     – vom Mitarbeiter gebucht, noch änderbar.
 *  freigegeben – vom Mitarbeiter selbst freigegeben → gesperrt und bereit für den DATEV-Sync.
 *  uebertragen – per Sync als Aufwandsbuchung nach DATEV EO geschrieben (M2; in M1 nur im Modell).
 * Nur freigegebene/übertragene Zeiten gelten als gültig (abrechenbar).
 */
export type TimeStatus = 'erfasst' | 'freigegeben' | 'uebertragen';

export interface TimeEntry {
  id: string;
  datum: string; // ISO-Datum (entspricht DATEV work_date — Arbeitsdatum, nicht entry_date)
  dauer: number; // Stunden (dezimal)
  status: TimeStatus;
  notiz?: string; // optionale Notiz zur Buchung (Pflicht bei Beratung/Mehraufwand)
  aufwandsart?: Aufwandsart; // nur bei Mehraufwand/Dumm gelaufen: gewählte EO-Aufwandsart
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

/**
 * Teilauftrag (Monat) für FiBu/Lohn — entspricht der Suborder-Ebene in DATEV EO.
 * `erledigtAm` ist das Analogon zu DATEV `date_work_completed` (kein Status-Enum auf Suborder-Ebene).
 */
export interface Suborder {
  id: string;
  monat: string; // "Jan 2025"
  soll: number; // Planstunden des Monats
  erfasst: number; // erfasste Stunden (Mock-Anzeige)
  erledigtAm?: string; // ISO
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
  /**
   * DATEV-Ordertype (Kurz-Code, z. B. "106", "JAP") — die **fachliche Identität** des Auftrags und
   * die einzige bebuchbare Auftragsart-Ebene. `art`/`artKey` sind hieraus abgeleitete Projektionen
   * (Anzeigename bzw. grober Farb-/Workflow-Bucket); siehe `src/lib/ordertypes.ts`.
   */
  ordertype: string;
  art: string; // ausgeschriebener Ordertype-Name (DATEV ordertype_name, z. B. "Monatliche Finanzbuchführung")
  artKey: ArtKey; // grober Bucket (Board-Farbe/Workflow), abgeleitet aus ordertype via artKeyForOrdertype()
  vj: number; // Veranlagungsjahr (DATEV EO: assessment_year)
  fristStart: string; // ISO
  fristEnde: string; // ISO
  monat: string; // abgeleitet, Anzeige z. B. "Mär 2025"
  soll: number; // Soll-Stunden
  seiten: number; // Ist-Seiten
  kosten: number; // Ist-Kosten in €
  status: StatusId;
  /** DATEV-Status „Fakturiert" (abgerechnet). In M2 per Hintergrund-API-Pull ermittelt, nicht in der App gepflegt. */
  fakturiert?: boolean;
  bearbeiter: string;
  bearbeiterId: string;
  partner: string;
  checklist: ChecklistItem[];
  suborders?: Suborder[]; // nur FiBu/Lohn: Monats-Teilaufträge
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
  tagessoll: number; // Stunden pro Arbeitstag
  arbeitstageProWoche: number; // Arbeitstage/Woche (Teilzeit: < 5) — Basis der Kapazität
}
