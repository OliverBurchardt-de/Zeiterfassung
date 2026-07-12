import type {
  User,
  OrderView,
  TimeEntry,
  Note,
  NoteComment,
  OrderOverlay,
  ChecklistItem,
  StatusChange,
  OutboxEntry,
  Anforderung,
  Besonderheit,
} from './types';

/**
 * „Ports" (Schnittstellen), die die Domain definiert und die Infrastruktur erfuellt (ADR-01/05).
 * So bleiben Fachlogik und Aussenwelt (DB/DATEV) getrennt und testbar.
 */

export interface UserRepository {
  findByUsername(username: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  list(): Promise<User[]>;
}

/** Zeiteintraege. IDs/Zeitstempel vergibt die Domaenen-Aktion, nicht das Repository. */
export interface TimeEntryRepository {
  insert(entry: TimeEntry): Promise<void>;
  findById(id: string): Promise<TimeEntry | undefined>;
  /** Fuer Wiederholungs-Requests: gleicher Key -> vorhandenen Eintrag liefern statt Dublette. */
  findByIdempotencyKey(key: string): Promise<TimeEntry | undefined>;
  listByOrder(orderId: string): Promise<TimeEntry[]>;
  update(entry: TimeEntry): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Review-Notes/Fragen inkl. Kommentaren. Loeschen einer Note entfernt ihre Kommentare mit. */
export interface NoteRepository {
  insert(note: Note): Promise<void>;
  findById(id: string): Promise<Note | undefined>;
  listByOrder(orderId: string): Promise<Note[]>;
  update(note: Note): Promise<void>;
  remove(id: string): Promise<void>;
  insertComment(comment: NoteComment): Promise<void>;
  listComments(noteId: string): Promise<NoteComment[]>;
}

/** Board-Overlay je DATEV-Auftrag (Feinstatus/Position/Umplanungs-Zaehler). */
export interface OverlayRepository {
  get(orderId: string): Promise<OrderOverlay | undefined>;
  list(): Promise<OrderOverlay[]>;
  upsert(overlay: OrderOverlay): Promise<void>;
}

/**
 * Checklisten-Instanz je Auftrag (aus der Vorlage instanziiert, dann abgehakt/ergaenzt).
 * Loeschen ist IMMER Soft-Delete (Review 12.07.2026, P1.3): der Punkt verschwindet aus der
 * aktiven Liste, bleibt aber mit Loeschendem + Zeitpunkt fuer Revision erhalten.
 */
export interface ChecklistRepository {
  /** Nur AKTIVE Punkte (ohne soft-geloeschte) — Basis fuer Anzeige und „Erledigt"-Gate. */
  listByOrder(orderId: string): Promise<ChecklistItem[]>;
  /** Soft-geloeschte Punkte eines Auftrags (Revisions-/Pruefsicht). */
  listDeletedByOrder(orderId: string): Promise<ChecklistItem[]>;
  findById(id: string): Promise<ChecklistItem | undefined>;
  insertMany(items: ChecklistItem[]): Promise<void>;
  /** Einzelnen Punkt anlegen (manuelles Hinzufuegen im Detail). */
  insert(item: ChecklistItem): Promise<void>;
  setDone(id: string, done: boolean): Promise<void>;
  /** Soft-Delete: markiert statt entfernt. Wer/Wann setzt die Domaenen-Aktion (Server-Zeit). */
  softDelete(id: string, deletedBy: string, deletedAt: string): Promise<void>;
}

export interface StatusHistoryRepository {
  insert(change: StatusChange): Promise<void>;
  listByOrder(orderId: string): Promise<StatusChange[]>;
}

/**
 * Outbox fuer DATEV-Rueckschreibungen (ADR-06). Der Sync-Job (M2) pollt `nextOpen`,
 * meldet Erfolg (`markUebertragen`), einen erneut versuchbaren Fehlversuch
 * (`markFehlversuch` — bleibt 'offen') oder gibt endgueltig auf (`markFehler`).
 */
export interface OutboxRepository {
  enqueue(entry: OutboxEntry): Promise<void>;
  nextOpen(limit: number): Promise<OutboxEntry[]>;
  markUebertragen(id: string): Promise<void>;
  markFehlversuch(id: string, error: string): Promise<void>;
  markFehler(id: string, error: string): Promise<void>;
}

export interface AnforderungRepository {
  insert(anforderung: Anforderung): Promise<void>;
  findById(id: string): Promise<Anforderung | undefined>;
  list(): Promise<Anforderung[]>;
  listByErsteller(userId: string): Promise<Anforderung[]>;
  update(anforderung: Anforderung): Promise<void>;
}

export interface BesonderheitRepository {
  listByKey(clientId: string, ordertype: string): Promise<Besonderheit[]>;
  insert(besonderheit: Besonderheit): Promise<void>;
  /** Aendert den Text; `updatedAt` stempelt das Repository selbst. */
  updateText(id: string, text: string): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Buendel aller Fach-Repositories — Memory und MS SQL liefern dieselbe Form. */
export interface Repositories {
  users: UserRepository;
  times: TimeEntryRepository;
  notes: NoteRepository;
  overlays: OverlayRepository;
  checklists: ChecklistRepository;
  statusHistory: StatusHistoryRepository;
  outbox: OutboxRepository;
  anforderungen: AnforderungRepository;
  besonderheiten: BesonderheitRepository;
}

/** Eine Aufwands-/Zeitbuchung, wie sie nach DATEV (expensepostings) geschrieben wird. */
export interface ExpensePosting {
  orderId: string;
  suborderId: string;
  employeeId: string;
  /** Arbeitsdatum im DATEV-Format "TT.MM.JJJJ 00:00:00". */
  workDate: string;
  costPosition: string;
  /** 1 Stunde = 1200 Einheiten (verifiziert). */
  timeUnits: number;
  comment?: string;
}

/** Die einzige Stelle, ueber die mit DATEV gesprochen wird — austauschbar (Mock/Live). */
export interface DatevPort {
  health(): Promise<boolean>;
  getOrders(): Promise<OrderView[]>;
  getOrder(id: string): Promise<OrderView | undefined>;
  postExpensePosting(p: ExpensePosting): Promise<{ id: string }>;
}
