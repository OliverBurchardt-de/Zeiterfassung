import type { PublicUser, TimeEntry, Aufwandsart } from '../types';
import type { Repositories } from '../ports';
import type { Clock } from '../clock';
import type { RequireVisibleOrder } from './access';
import { DomainError } from '../errors';
import { isValidTimeDuration } from '../rules';

export interface BookTimeInput {
  orderId: string;
  suborderId?: string;
  /** ISO-Datum "JJJJ-MM-TT" (DATEV work_date). */
  datum: string;
  dauer: number;
  notiz?: string;
  aufwandsart?: Aufwandsart;
  /**
   * Optionaler Idempotenz-Schluessel des Clients (verhindert Doppelbuchung bei erneutem Klick/
   * Retry). Ohne Angabe erzeugt der Server einen — dann ist jeder Aufruf eine neue Buchung.
   */
  idempotencyKey?: string;
}

/**
 * Zeit-Aktionen (serverseitig verbindlich). Grundregel: Jeder bucht/aendert nur EIGENE Zeiten,
 * es gibt KEINE Partner-Freigabe — der Erfasser gibt selbst frei (CLAUDE.md, TimeStatus).
 * Bereits nach DATEV uebertragene Zeiten (status 'uebertragen') sind gesperrt.
 */
export function createTimeActions(repos: Repositories, clock: Clock, requireVisibleOrder: RequireVisibleOrder) {
  /** Laedt den Eintrag und stellt sicher, dass er dem Handelnden gehoert. */
  async function ownEntry(actor: PublicUser, id: string): Promise<TimeEntry> {
    const entry = await repos.times.findById(id);
    if (!entry) throw new DomainError('not_found', 'Zeiteintrag nicht gefunden');
    if (entry.userId !== actor.id) throw new DomainError('forbidden', 'nicht der eigene Zeiteintrag');
    return entry;
  }

  return {
    async bookTime(actor: PublicUser, input: BookTimeInput): Promise<TimeEntry> {
      // Nur auf sichtbare/zugewiesene Auftraege buchen — sonst landeten (nach Freigabe/Sync)
      // Aufwandsbuchungen auf fremden Mandaten (Review-Befund 5).
      await requireVisibleOrder(actor, input.orderId);
      if (!isValidTimeDuration(input.dauer)) throw new DomainError('invalid', 'Dauer muss groesser 0 sein');

      // Idempotenz: gleicher Client-Key -> vorhandene Buchung zurueckgeben, keine Dublette.
      if (input.idempotencyKey) {
        const bestehend = await repos.times.findByIdempotencyKey(input.idempotencyKey);
        if (bestehend) return bestehend;
      }

      const entry: TimeEntry = {
        id: clock.newId(),
        userId: actor.id,
        orderId: input.orderId,
        suborderId: input.suborderId,
        datum: input.datum,
        dauer: input.dauer,
        notiz: input.notiz,
        status: 'erfasst',
        aufwandsart: input.aufwandsart,
        idempotencyKey: input.idempotencyKey ?? clock.newId(),
        createdAt: clock.now(),
      };
      await repos.times.insert(entry);
      return entry;
    },

    /** erfasst -> freigegeben (nur der eigene, noch nicht uebertragene Eintrag). */
    async releaseTime(actor: PublicUser, id: string): Promise<TimeEntry> {
      const entry = await ownEntry(actor, id);
      if (entry.status === 'uebertragen') throw new DomainError('conflict', 'bereits nach DATEV uebertragen');
      if (entry.status === 'freigegeben') return entry; // idempotent
      const next: TimeEntry = { ...entry, status: 'freigegeben' };
      await repos.times.update(next);
      return next;
    },

    /** freigegeben -> erfasst (Freigabe zuruecknehmen, solange nicht uebertragen). */
    async withdrawTime(actor: PublicUser, id: string): Promise<TimeEntry> {
      const entry = await ownEntry(actor, id);
      if (entry.status === 'uebertragen') throw new DomainError('conflict', 'bereits nach DATEV uebertragen');
      if (entry.status === 'erfasst') return entry; // idempotent
      const next: TimeEntry = { ...entry, status: 'erfasst' };
      await repos.times.update(next);
      return next;
    },

    async deleteTime(actor: PublicUser, id: string): Promise<void> {
      const entry = await ownEntry(actor, id);
      if (entry.status === 'uebertragen') throw new DomainError('conflict', 'bereits nach DATEV uebertragen');
      await repos.times.remove(id);
    },

    async listMine(actor: PublicUser): Promise<TimeEntry[]> {
      return repos.times.listByUser(actor.id);
    },
  };
}

export type TimeActions = ReturnType<typeof createTimeActions>;
