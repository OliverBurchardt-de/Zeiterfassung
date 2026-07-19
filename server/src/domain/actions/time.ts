import type { PublicUser, TimeEntry, Aufwandsart } from '../types';
import type { Repositories } from '../ports';
import type { Clock } from '../clock';
import type { RequireVisibleOrder } from './access';
import { DomainError } from '../errors';
import { isValidTimeDuration } from '../rules';
import { LIMITS, isValidIsoDate } from '../limits';
import { ordertypeNeedsNotiz, ordertypeHasTeilauftraege } from '../ordertypeRules';

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
  /**
   * Buchen FUER einen anderen Mitarbeiter (Nacherfassung durch das Backoffice). Nur Backoffice
   * oder Admin duerfen das setzen (serverseitig erzwungen); die Zeit gehoert dann diesem Nutzer.
   */
  onBehalfOfUserId?: string;
}

/**
 * Zeit-Aktionen (serverseitig verbindlich). Grundregel: Jeder bucht/aendert nur EIGENE Zeiten,
 * es gibt KEINE Partner-Freigabe — der Erfasser gibt selbst frei (CLAUDE.md, TimeStatus).
 * Bereits nach DATEV uebertragene Zeiten (status 'uebertragen') sind gesperrt.
 */
/**
 * Idempotenz-Wiederholungsfall pruefen (Review P2.5): Der bestehende Eintrag wird NUR
 * zurueckgegeben, wenn er demselben Nutzer gehoert (403 sonst — nie fremde Buchungen
 * herausgeben) UND die Nutzlast uebereinstimmt (409 sonst — Schluessel-Wiederverwendung
 * mit anderem Inhalt ist ein Programmierfehler des Clients, kein Erfolgsfall).
 */
function gleicheBuchungOderKonflikt(zielUserId: string, input: BookTimeInput, bestehend: TimeEntry): TimeEntry {
  // Ownership-Vergleich gegen den EFFEKTIVEN Nutzer (bei Backoffice-Buchung der Zielmitarbeiter,
  // sonst der Handelnde) — ein fremder Schluessel liefert nie die fremde Buchung.
  if (bestehend.userId !== zielUserId) {
    throw new DomainError('forbidden', 'Idempotenz-Schluessel ist bereits vergeben');
  }
  const gleich =
    bestehend.orderId === input.orderId &&
    (bestehend.suborderId ?? null) === (input.suborderId ?? null) &&
    bestehend.datum === input.datum &&
    bestehend.dauer === input.dauer &&
    (bestehend.notiz ?? null) === (input.notiz ?? null) &&
    (bestehend.aufwandsart ?? null) === (input.aufwandsart ?? null);
  if (!gleich) {
    throw new DomainError('conflict', 'Idempotenz-Schluessel wurde bereits mit anderer Buchung verwendet');
  }
  return bestehend;
}

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
      const order = await requireVisibleOrder(actor, input.orderId);

      // Buchen fuer einen anderen Mitarbeiter (Backoffice-Nacherfassung): nur Backoffice/Admin,
      // und nur auf einen existierenden aktiven Nutzer. Sonst gehoert die Zeit dem Handelnden.
      let zielUserId = actor.id;
      if (input.onBehalfOfUserId && input.onBehalfOfUserId !== actor.id) {
        if (actor.role !== 'backoffice' && !actor.admin) {
          throw new DomainError('forbidden', 'nur Backoffice oder Admin darf fuer andere buchen');
        }
        const ziel = await repos.users.findById(input.onBehalfOfUserId);
        if (!ziel) throw new DomainError('not_found', 'Zielnutzer nicht gefunden');
        zielUserId = ziel.id;
      }
      if (!isValidTimeDuration(input.dauer)) {
        throw new DomainError('invalid', `Dauer muss zwischen 0 und ${LIMITS.DAUER_MAX_STUNDEN} Stunden liegen (max. 2 Nachkommastellen)`);
      }
      // Echte Kalenderpruefung (Review P2.4): "2026-02-30" hat das richtige Format, ist aber kein Tag.
      if (!isValidIsoDate(input.datum)) throw new DomainError('invalid', 'kein gueltiges Datum (JJJJ-MM-TT)');
      if ((input.notiz ?? '').length > LIMITS.TEXT_MAX) {
        throw new DomainError('invalid', `Notiz ist zu lang (max. ${LIMITS.TEXT_MAX} Zeichen)`);
      }

      // Ordertype-Buchungsregeln serverseitig verbindlich (Review P1-3): bisher nur im Browser.
      // (1) Pflicht-Notiz auf laufenden Arten (Mehraufwand/lfd. Beratung).
      if (ordertypeNeedsNotiz(order.ordertype) && !(input.notiz ?? '').trim()) {
        throw new DomainError('invalid', 'Fuer diese Auftragsart ist eine Notiz Pflicht');
      }
      // (2) Teilauftragszuordnung gegen den geladenen Auftrag pruefen: die suborderId muss ein
      // echter Teilauftrag DIESES Auftrags sein — und nur Ordertypes mit Teilaufträgen haben welche.
      if (input.suborderId !== undefined) {
        if (!ordertypeHasTeilauftraege(order.ordertype)) {
          throw new DomainError('invalid', 'Diese Auftragsart hat keine Teilauftraege');
        }
        // Robust gegen beide Adressierungen: echte DATEV-suborder.id ODER die suborder_number,
        // die das Frontend heute als id sendet (bis die echte ID durchs Frontendmodell geführt ist).
        const gehoert = (order.suborders ?? []).some(
          (s) => s.id === input.suborderId || String(s.number) === input.suborderId
        );
        if (!gehoert) throw new DomainError('invalid', 'Teilauftrag gehoert nicht zu diesem Auftrag');
      }

      // Idempotenz (gehaertet, Review P2.5): gleicher Client-Key liefert die vorhandene Buchung
      // NUR zurueck, wenn Nutzer UND Nutzlast uebereinstimmen. Ein fremder oder abweichend
      // wiederverwendeter Schluessel ist ein Konflikt — nie die fremde/alte Buchung.
      if (input.idempotencyKey) {
        const bestehend = await repos.times.findByIdempotencyKey(input.idempotencyKey);
        if (bestehend) return gleicheBuchungOderKonflikt(zielUserId, input, bestehend);
      }

      const entry: TimeEntry = {
        id: clock.newId(),
        userId: zielUserId,
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
      // Tagesgrenze (Fachregel 12.07.2026): max. 12 h/Tag ueber ALLE Auftraege des Nutzers.
      // Pruefung + Insert ATOMAR (Review P1-4): parallele Buchungen koennen nicht gemeinsam
      // ueber die Grenze einfuegen (fruehere getrennte Summe+Insert war nicht nebenlaeufigkeitsfest).
      let ergebnis: { ok: true } | { ok: false; bereits: number };
      try {
        ergebnis = await repos.times.insertWithinDailyLimit(entry, LIMITS.DAUER_MAX_STUNDEN);
      } catch (err) {
        // Parallelfall (Review P2.5): zwei gleichzeitige Requests mit demselben Schluessel —
        // der zweite Insert faellt auf den Unique-Index (uq_time_idem bzw. Memory-Pendant).
        // Kontrolliert aufloesen: den inzwischen vorhandenen Eintrag wie einen Wiederholungsfall
        // behandeln.
        if (input.idempotencyKey) {
          const inzwischen = await repos.times.findByIdempotencyKey(input.idempotencyKey);
          if (inzwischen) return gleicheBuchungOderKonflikt(zielUserId, input, inzwischen);
        }
        throw err;
      }
      if (!ergebnis.ok) {
        throw new DomainError(
          'conflict',
          `Tagesgrenze ueberschritten: max. ${LIMITS.DAUER_MAX_STUNDEN} h pro Tag (bereits gebucht: ${ergebnis.bereits} h)`
        );
      }
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

    /**
     * Loeschen NUR im Status 'erfasst' (verbindliche Entscheidung, Review 12.07.2026):
     * 'freigegeben' ist fuer den DATEV-Sync vorgemerkt, 'uebertragen' bereits gebucht — beide
     * gesperrt. Wer loeschen will, nimmt zuerst die Freigabe zurueck (withdraw).
     */
    async deleteTime(actor: PublicUser, id: string): Promise<void> {
      const entry = await ownEntry(actor, id);
      if (entry.status === 'uebertragen') throw new DomainError('conflict', 'bereits nach DATEV uebertragen');
      if (entry.status === 'freigegeben') {
        throw new DomainError('conflict', 'freigegebene Zeit zuerst zurueckziehen, dann loeschen');
      }
      await repos.times.remove(id);
    },
  };
}

export type TimeActions = ReturnType<typeof createTimeActions>;
