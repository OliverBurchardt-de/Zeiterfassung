/** Fachliche Kerntypen der Domain-Schicht. Kennen weder Datenbank noch DATEV. */

export type Role = 'mitarbeiter' | 'partner' | 'backoffice';

/** Die 10 Kanban-Board-Status (App-intern; Spiegel von src/lib/tokens.ts StatusId). 'er' = Erledigt. */
export type StatusId = 'av' | 'ua' | 'uv' | 'bb' | 'rf' | 'rn' | 'fg' | 'am' | 'fa' | 'er';
export const STATUS_IDS: StatusId[] = ['av', 'ua', 'uv', 'bb', 'rf', 'rn', 'fg', 'am', 'fa', 'er'];

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
  /**
   * false = deaktiviert (Review P3.7): wirkt SOFORT, weil der Auth-Hook den Nutzer bei jedem
   * Request neu laedt und beide Repos Deaktivierte nicht liefern (SQL: WHERE active = 1).
   * Fehlend = aktiv.
   */
  active?: boolean;
  /** Tageslimit „Kanzleiverwaltung" (Ordertype 9801) in Minuten; undefined = unbegrenzt. */
  kvLimitMin?: number;
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
  /** DATEV planned_start/planned_end (ISO "JJJJ-MM-TT") — Basis des geplanten Monats im Board. */
  plannedStart?: string;
  plannedEnd?: string;
  /**
   * Mandanten-Anzeige (Name/Nummer). DATEV-Orders tragen nur die client_id (GUID) — Name/Nummer
   * kommen aus den Client Master Data (Lookup im Board-Aggregat via datev.getClients()). Der Mock
   * liefert sie direkt. Optional: Frontend faellt auf die clientId zurueck.
   */
  clientName?: string;
  clientNumber?: string;
  /**
   * Teilauftraege (DATEV suborders, via `expand` mitgeladen) — nur bei Ordertypes mit
   * Teilauftrags-Rhythmus gefuellt. Basis der Karten-Anzeige „naechster offener Teilauftrag".
   */
  suborders?: SuborderView[];
}

/** Teilauftrag eines Auftrags (DATEV suborder) — reduziert auf die App-relevanten Felder. */
export interface SuborderView {
  /**
   * Echte DATEV-Teilauftrags-ID (suborder.id) — die der DATEV-POST im URL-Pfad verlangt
   * (Review P1-2). Wird durchgereicht, damit eine spätere Rückschreibung den korrekten
   * Teilauftrag adressiert; `number` bleibt für Anzeige/Zuordnung erhalten.
   */
  id?: string;
  number: number; // suborder_number (eindeutig je Auftrag)
  name: string; // suborder_name, z. B. "Januar 2026"
  /** Leistungszeitraum (ISO "JJJJ-MM-TT") — bestimmt den Teilauftrags-Monat. */
  periodFrom?: string;
  periodTo?: string;
  plannedHours?: number;
  /** DATEV date_work_completed — gesetzt = Teilauftrag abgeschlossen. */
  dateWorkCompleted?: string;
}

/** Mandanten-Stammdaten (Client Master Data) — fuer die Namensaufloesung am Board. */
export interface DatevClient {
  id: string; // GUID (referenziert von Order.clientId)
  name: string;
  number?: string;
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

/**
 * Herkunft eines Checklistenpunkts (Review 12.07.2026, P1.2): 'vorlage' = Pflichtpunkt aus einer
 * Checklisten-Vorlage (darf NIE geloescht werden), 'manuell' = am Auftrag ergaenzt (loeschbar,
 * aber nur als Soft-Delete — revisionssicher).
 */
export type ChecklistHerkunft = 'vorlage' | 'manuell';

/** Checklisten-Instanz-Punkt je Auftrag (Grundlage der serverseitigen canComplete-Regel). */
export interface ChecklistItem {
  id: string;
  orderId: string;
  label: string;
  done: boolean;
  position: number;
  herkunft: ChecklistHerkunft;
  /** Soft-Delete (nur manuelle Punkte): gesetzt = nicht mehr aktiv; Inhalt bleibt fuer Revision. */
  deletedAt?: string;
  /** Nutzer-ID des Loeschenden — setzt der Server, nie der Client. */
  deletedBy?: string;
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
