import type {
  User,
  TimeEntry,
  Note,
  NoteComment,
  OrderOverlay,
  ChecklistItem,
  StatusChange,
  OutboxEntry,
  Anforderung,
  Besonderheit,
} from '../../domain/types';
import type {
  Repositories,
  TimeEntryRepository,
  NoteRepository,
  OverlayRepository,
  ChecklistRepository,
  StatusHistoryRepository,
  OutboxRepository,
  AnforderungRepository,
  BesonderheitRepository,
  StatusWechselTransaktion,
} from '../../domain/ports';
import { createMemoryUserRepository } from './users';

/**
 * In-Memory-Fach-Repositories — erfuellen dieselben Ports wie die MS-SQL-Variante
 * (infra/mssql). Fuer Entwicklung ohne Datenbank (DB_MODE=memory) und fuer Tests der
 * Domaenen-Aktionen. Sortierungen bewusst identisch zu den SQL-ORDER-BY-Klauseln.
 */

export function createMemoryTimeEntryRepository(entries: TimeEntry[] = []): TimeEntryRepository {
  // Neueste zuerst (wie "Meine Zeiten"): Arbeitsdatum, dann Erfassungszeitpunkt.
  const neuesteZuerst = (a: TimeEntry, b: TimeEntry): number =>
    b.datum.localeCompare(a.datum) || b.createdAt.localeCompare(a.createdAt);
  return {
    async insert(entry) {
      // Gleiche Garantie wie der SQL-Unique-Index uq_time_idem: doppelter Idempotenz-
      // Schluessel schlaegt fehl — die Domaenen-Aktion loest den Parallelfall kontrolliert auf.
      if (entries.some((e) => e.idempotencyKey === entry.idempotencyKey)) {
        throw new Error('unique violation: idempotency_key');
      }
      entries.push({ ...entry });
    },
    async insertWithinDailyLimit(entry, maxStunden) {
      // Synchroner Rumpf (kein await zwischen Summe und Insert) => im Ein-Prozess-Betrieb atomar:
      // zwei parallele bookTime-Aufrufe koennen nicht dieselbe alte Summe sehen (Review P1-4).
      const bereits = entries
        .filter((e) => e.userId === entry.userId && e.datum === entry.datum)
        .reduce((s, e) => s + e.dauer, 0);
      const summe = Math.round((bereits + entry.dauer) * 100) / 100;
      if (summe > maxStunden) return { ok: false, bereits };
      if (entries.some((e) => e.idempotencyKey === entry.idempotencyKey)) {
        throw new Error('unique violation: idempotency_key');
      }
      entries.push({ ...entry });
      return { ok: true };
    },
    async findById(id) {
      return entries.find((e) => e.id === id);
    },
    async findByIdempotencyKey(key) {
      return entries.find((e) => e.idempotencyKey === key);
    },
    async listByOrder(orderId) {
      return entries.filter((e) => e.orderId === orderId).sort(neuesteZuerst);
    },
    async sumByUserAndDate(userId, datum) {
      return entries
        .filter((e) => e.userId === userId && e.datum === datum)
        .reduce((sum, e) => sum + e.dauer, 0);
    },
    async update(entry) {
      const i = entries.findIndex((e) => e.id === entry.id);
      if (i >= 0) entries[i] = { ...entry };
    },
    async remove(id) {
      const i = entries.findIndex((e) => e.id === id);
      if (i >= 0) entries.splice(i, 1);
    },
  };
}

export function createMemoryNoteRepository(notes: Note[] = [], comments: NoteComment[] = []): NoteRepository {
  return {
    async insert(note) {
      notes.push({ ...note });
    },
    async findById(id) {
      return notes.find((n) => n.id === id);
    },
    async listByOrder(orderId) {
      // Thread-Reihenfolge: aelteste zuerst.
      return notes.filter((n) => n.orderId === orderId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async update(note) {
      const i = notes.findIndex((n) => n.id === note.id);
      if (i >= 0) notes[i] = { ...note };
    },
    async remove(id) {
      const i = notes.findIndex((n) => n.id === id);
      if (i >= 0) notes.splice(i, 1);
      // Kommentare gehoeren zur Note — mit entfernen (wie DELETE-Kaskade in mssql/notes.ts).
      for (let c = comments.length - 1; c >= 0; c--) {
        if (comments[c].noteId === id) comments.splice(c, 1);
      }
    },
    async insertComment(comment) {
      comments.push({ ...comment });
    },
    async listComments(noteId) {
      return comments.filter((c) => c.noteId === noteId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
  };
}

export function createMemoryOverlayRepository(overlays: OrderOverlay[] = []): OverlayRepository {
  return {
    async get(orderId) {
      return overlays.find((o) => o.orderId === orderId);
    },
    async list() {
      return [...overlays];
    },
    async upsert(overlay) {
      const i = overlays.findIndex((o) => o.orderId === overlay.orderId);
      if (i >= 0) overlays[i] = { ...overlay };
      else overlays.push({ ...overlay });
    },
  };
}

export function createMemoryChecklistRepository(items: ChecklistItem[] = []): ChecklistRepository {
  return {
    async listByOrder(orderId) {
      return items.filter((i) => i.orderId === orderId && !i.deletedAt).sort((a, b) => a.position - b.position);
    },
    async listDeletedByOrder(orderId) {
      return items.filter((i) => i.orderId === orderId && !!i.deletedAt).sort((a, b) => a.position - b.position);
    },
    async findById(id) {
      return items.find((i) => i.id === id);
    },
    async insertMany(neue) {
      for (const item of neue) items.push({ ...item });
    },
    async insert(item) {
      items.push({ ...item });
    },
    async setDone(id, done) {
      const item = items.find((i) => i.id === id);
      if (item) item.done = done;
    },
    async softDelete(id, deletedBy, deletedAt) {
      const item = items.find((i) => i.id === id);
      if (item) {
        item.deletedAt = deletedAt;
        item.deletedBy = deletedBy;
      }
    },
  };
}

export function createMemoryStatusHistoryRepository(changes: StatusChange[] = []): StatusHistoryRepository {
  return {
    async insert(change) {
      changes.push({ ...change });
    },
    async listByOrder(orderId) {
      return changes.filter((c) => c.orderId === orderId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
  };
}

export function createMemoryOutboxRepository(entries: OutboxEntry[] = []): OutboxRepository {
  return {
    async enqueue(entry) {
      entries.push({ ...entry });
    },
    async nextOpen(limit) {
      return entries
        .filter((e) => e.status === 'offen')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit);
    },
    async markUebertragen(id) {
      const e = entries.find((x) => x.id === id);
      if (e) {
        e.status = 'uebertragen';
        e.processedAt = new Date().toISOString();
      }
    },
    async markFehlversuch(id, error) {
      const e = entries.find((x) => x.id === id);
      if (e) {
        e.attempts += 1;
        e.lastError = error;
      }
    },
    async markFehler(id, error) {
      const e = entries.find((x) => x.id === id);
      if (e) {
        e.status = 'fehler';
        e.attempts += 1;
        e.lastError = error;
      }
    },
  };
}

export function createMemoryAnforderungRepository(items: Anforderung[] = []): AnforderungRepository {
  // Neueste zuerst (Backoffice-Inbox).
  const neuesteZuerst = (a: Anforderung, b: Anforderung): number => b.createdAt.localeCompare(a.createdAt);
  return {
    async insert(anforderung) {
      items.push({ ...anforderung });
    },
    async findById(id) {
      return items.find((a) => a.id === id);
    },
    async list() {
      return [...items].sort(neuesteZuerst);
    },
    async listByErsteller(userId) {
      return items.filter((a) => a.erstelltVonId === userId).sort(neuesteZuerst);
    },
    async update(anforderung) {
      const i = items.findIndex((a) => a.id === anforderung.id);
      if (i >= 0) items[i] = { ...anforderung };
    },
  };
}

export function createMemoryBesonderheitRepository(items: Besonderheit[] = []): BesonderheitRepository {
  return {
    async listByKey(clientId, ordertype) {
      return items
        .filter((b) => b.clientId === clientId && b.ordertype === ordertype)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async insert(besonderheit) {
      items.push({ ...besonderheit });
    },
    async updateText(id, text) {
      const b = items.find((x) => x.id === id);
      if (b) {
        b.text = text;
        b.updatedAt = new Date().toISOString();
      }
    },
    async remove(id) {
      const i = items.findIndex((b) => b.id === id);
      if (i >= 0) items.splice(i, 1);
    },
  };
}

/** Das komplette Buendel fuer DB_MODE=memory — Gegenstueck zu createMssqlRepositories. */
/**
 * Memory-Pendant zur MSSQL-Transaktion: sequenzielle Schreibvorgaenge — im Ein-Prozess-Betrieb
 * ohne echte Nebenlaeufigkeit die passende (und einzige moegliche) "Atomaritaet".
 */
export function createMemoryStatusWechselTransaktion(
  overlays: OverlayRepository,
  statusHistory: StatusHistoryRepository,
  outbox: OutboxRepository
): StatusWechselTransaktion {
  return {
    async commitStatusWechsel(overlay, change, outboxEntry) {
      await overlays.upsert(overlay);
      if (change) await statusHistory.insert(change);
      if (outboxEntry) await outbox.enqueue(outboxEntry);
    },
  };
}

export function createMemoryRepositories(users: User[]): Repositories {
  const overlays = createMemoryOverlayRepository();
  const statusHistory = createMemoryStatusHistoryRepository();
  const outbox = createMemoryOutboxRepository();
  return {
    users: createMemoryUserRepository(users),
    times: createMemoryTimeEntryRepository(),
    notes: createMemoryNoteRepository(),
    overlays,
    checklists: createMemoryChecklistRepository(),
    statusHistory,
    outbox,
    anforderungen: createMemoryAnforderungRepository(),
    besonderheiten: createMemoryBesonderheitRepository(),
    statusTransaktion: createMemoryStatusWechselTransaktion(overlays, statusHistory, outbox),
  };
}
