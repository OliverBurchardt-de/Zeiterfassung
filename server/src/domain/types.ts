/** Fachliche Kerntypen der Domain-Schicht. Kennen weder Datenbank noch DATEV. */

export type Role = 'mitarbeiter' | 'partner';

export type TimeStatus = 'erfasst' | 'freigegeben' | 'uebertragen';
export type Aufwandsart = 'mehraufwand' | 'dumm';
export type NoteKind = 'frage' | 'review';
export type NoteState = 'offen' | 'erledigt' | 'freigegeben';
export type AnforderungStatus = 'angefordert' | 'angelegt' | 'abgelehnt';
export type OutboxKind = 'order-put' | 'suborder-put' | 'expense-posting';
export type OutboxStatus = 'offen' | 'uebertragen' | 'fehler';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  admin: boolean;
  passwordHash: string;
  datevEmployeeId?: string;
}

/** Nutzer-Sicht ohne Geheimnisse — alles, was nach aussen gehen darf. */
export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(u: User): PublicUser {
  const { passwordHash, ...pub } = u;
  void passwordHash; // bewusst verworfen — nie nach aussen geben
  return pub;
}

/**
 * Vereinfachte Auftrags-Sicht, wie sie der DATEV-Adapter liefert (projiziert aus dem EO-Order,
 * Feld-Referenz: docs/datev-connect-handoff.md §3b).
 * Konvention: DATEV liefert `id`/`order_id` als Integer — der Adapter konvertiert nach String
 * (stabile, vergleichbare Schlüssel im App-Kontext); zurück Richtung DATEV wird wieder geparst.
 */
export interface OrderView {
  id: string;
  orderNumber: number;
  /** DATEV creation_year — order_number ist nur zusammen mit dem Anlagejahr eindeutig. */
  creationYear?: number;
  ordertype: string;
  name: string;
  status: string;
  clientId: string;
  /** DATEV order_responsible1_id → App-Nutzer (Bearbeiter). */
  responsibleId?: string;
  /** DATEV order_partner_id → mandatsverantwortlicher Partner (Basis der Partner-Sichtbarkeit). */
  partnerId?: string;
  isInternal: boolean;
  plannedHours: number;
  assessmentYear?: number;
  /** DATEV billing_status — Quelle des Controllings „noch nicht abgerechnet". */
  billingStatus?: string;
}

/**
 * Zeiteintrag (Kern der Zeiterfassung; Feldnamen wie im Frontend-Modell).
 * `datum` = DATEV work_date (Arbeitsdatum — massgeblich, nicht der Sync-Zeitpunkt).
 * `idempotencyKey` verhindert Dubletten beim nicht-idempotenten DATEV-POST (Handoff §7).
 */
export interface TimeEntry {
  id: string;
  userId: string;
  orderId: string;
  suborderId?: string;
  /** ISO-Datum "JJJJ-MM-TT". */
  datum: string;
  /** Stunden dezimal (DATEV: 1 h = 1200 time_units — Umrechnung erst beim Sync). */
  dauer: number;
  notiz?: string;
  status: TimeStatus;
  aufwandsart?: Aufwandsart;
  /** DATEV cost_position (Pflichtfeld der Aufwandsbuchung beim Sync). */
  costPosition?: string;
  /** ID der erzeugten DATEV-Aufwandsbuchung (gesetzt vom Sync, Status 'uebertragen'). */
  datevPostingId?: string;
  idempotencyKey: string;
  createdAt: string;
}

/** Review-Note / Frage (Thread-Kopf). Workflow-Regeln in domain/policies.ts, nicht hier. */
export interface Note {
  id: string;
  orderId: string;
  kind: NoteKind;
  noteState: NoteState;
  text: string;
  authorId: string;
  createdAt: string;
}

export interface NoteComment {
  id: string;
  noteId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

/**
 * App-Zusatzdaten je DATEV-Auftrag (Overlay) — Board-Feinstatus/-Position und der
 * Umplanungs-Zaehler (1 Auftrag traegt genau 1 Veranlagungsjahr, s. Schema).
 */
export interface OrderOverlay {
  orderId: string;
  boardStatus?: string;
  boardPosition?: number;
  umplanungenVerbraucht: number;
}

/** Checklisten-Instanz-Punkt je Auftrag (Grundlage der serverseitigen canComplete-Regel). */
export interface ChecklistItem {
  id: string;
  orderId: string;
  label: string;
  done: boolean;
  position: number;
}

/** Ein Kanban-Statuswechsel (Nachvollziehbarkeit + Basis fuer den DATEV-Writeback). */
export interface StatusChange {
  id: string;
  orderId: string;
  fromStatus?: string;
  toStatus: string;
  actorId: string;
  createdAt: string;
}

/** Ausstehende Rueckschreibung nach DATEV (Pull+Outbox, ADR-06). `payload` = JSON-Body. */
export interface OutboxEntry {
  id: string;
  kind: OutboxKind;
  payload: string;
  idempotencyKey: string;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  processedAt?: string;
}

/** Auftrags-Anforderung (Workflow, kein DATEV-Write — DATEV kennt kein POST /orders). */
export interface Anforderung {
  id: string;
  mandant: string;
  mandantNr: string;
  ordertype: string;
  vj: number;
  zeitraum?: string;
  notiz: string;
  /** Anzeigename + Nutzer-ID getrennt: die ID traegt die Sichtbarkeit, der Name bleibt lesbar. */
  erstelltVon: string;
  erstelltVonId: string;
  status: AnforderungStatus;
  grund?: string;
  createdAt: string;
  erledigtAm?: string;
}

/** Mandantenbesonderheit am period-unabhaengigen Schluessel clientId + ordertype. */
export interface Besonderheit {
  id: string;
  clientId: string;
  ordertype: string;
  text: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}
