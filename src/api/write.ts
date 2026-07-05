import { api, ApiError } from './client';
import { apiReloadOrders } from './session';
import { useStore } from '@/state/store';
import type { NoteState } from '@/lib/types';
import type { ApiBookTimeInput } from './types';

/**
 * Schreib-Kopplung im Server-Modus (Etappe 2).
 *
 * Ablauf je Aktion: Der Store macht zuerst ein **optimistisches** lokales Update (die UI reagiert
 * sofort), danach ruft er die passende Funktion hier — sie schreibt die Änderung serverseitig fest.
 *  - Erfolg bei Neuanlagen (Zeit/Note/Kommentar): die temporär vergebene Client-ID wird gegen die
 *    echte Server-ID getauscht, damit Folge-Aktionen (Freigeben/Löschen/…) den richtigen Datensatz
 *    treffen. Der Idempotenz-Schlüssel der Buchung ist zugleich diese temporäre ID → ein Retry
 *    erzeugt keine Dublette.
 *  - Fehler: Meldung in `syncError` und Board frisch vom Server laden (`apiReloadOrders`) — das
 *    verwirft das optimistische Update und stellt den echten Serverstand her.
 *
 * Bewusst „feuern und vergessen" (die Store-Aktionen bleiben synchron): Erfolg braucht keine
 * UI-Reaktion, der Fehlerfall wird hier zentral behandelt.
 */

function fail(was: string) {
  return async (err: unknown): Promise<void> => {
    const msg = err instanceof ApiError ? err.message : 'unbekannter Fehler';
    useStore.getState().setSyncError(`${was} konnte nicht gespeichert werden: ${msg}`);
    try {
      await apiReloadOrders();
    } catch {
      // Server nicht erreichbar — lokalen Stand belassen; der Nutzer sieht die Fehlermeldung.
    }
  };
}

/** Temporäre ID eines neuen Zeiteintrags gegen die echte Server-ID tauschen. */
function reconcileTime(orderId: string, tempId: string, realId: string): void {
  if (tempId === realId) return;
  useStore.setState((s) => ({
    orders: s.orders.map((o) => (o.id === orderId
      ? { ...o, times: o.times.map((t) => (t.id === tempId ? { ...t, id: realId } : t)) }
      : o)),
  }));
}

/** Temporäre ID einer neuen Note gegen die echte Server-ID tauschen. */
function reconcileNote(orderId: string, tempId: string, realId: string): void {
  if (tempId === realId) return;
  useStore.setState((s) => ({
    orders: s.orders.map((o) => (o.id === orderId
      ? { ...o, notes: o.notes.map((n) => (n.id === tempId ? { ...n, id: realId } : n)) }
      : o)),
  }));
}

/** Temporäre ID eines neuen Kommentars gegen die echte Server-ID tauschen. */
function reconcileComment(orderId: string, noteId: string, tempId: string, realId: string): void {
  if (tempId === realId) return;
  useStore.setState((s) => ({
    orders: s.orders.map((o) => (o.id === orderId
      ? {
        ...o,
        notes: o.notes.map((n) => (n.id === noteId
          ? { ...n, comments: n.comments.map((c) => (c.id === tempId ? { ...c, id: realId } : c)) }
          : n)),
      }
      : o)),
  }));
}

export const write = {
  // --- Zeit ---------------------------------------------------------------
  bookTime(orderId: string, tempId: string, input: ApiBookTimeInput): void {
    void api.bookTime({ ...input, idempotencyKey: tempId })
      .then((e) => reconcileTime(orderId, tempId, e.id))
      .catch(fail('Zeitbuchung'));
  },
  releaseTime(id: string): void {
    void api.releaseTime(id).catch(fail('Freigabe der Zeit'));
  },
  withdrawTime(id: string): void {
    void api.withdrawTime(id).catch(fail('Zurückziehen der Freigabe'));
  },
  deleteTime(id: string): void {
    void api.deleteTime(id).catch(fail('Löschen der Zeit'));
  },

  // --- Status -------------------------------------------------------------
  setStatus(orderId: string, status: string): void {
    void api.setStatus(orderId, status).catch(fail('Statuswechsel'));
  },

  // --- Review-Notes / Fragen ---------------------------------------------
  createNote(orderId: string, tempId: string, text: string): void {
    void api.createNote(orderId, text)
      .then((n) => reconcileNote(orderId, tempId, n.id))
      .catch(fail('Anlegen der Notiz'));
  },
  editNote(id: string, text: string): void {
    void api.editNote(id, text).catch(fail('Bearbeiten der Notiz'));
  },
  comment(orderId: string, noteId: string, tempId: string, text: string): void {
    void api.commentNote(noteId, text)
      .then((c) => reconcileComment(orderId, noteId, tempId, c.id))
      .catch(fail('Kommentar'));
  },
  /** Zielzustand → passender Endpunkt (erledigt/freigeben/wieder öffnen). */
  setNoteState(noteId: string, state: NoteState): void {
    const call = state === 'erledigt' ? api.noteDone(noteId)
      : state === 'freigegeben' ? api.noteApprove(noteId)
        : api.noteReopen(noteId); // 'offen'
    void call.catch(fail('Statusänderung der Notiz'));
  },
  deleteNote(id: string): void {
    void api.deleteNote(id).catch(fail('Löschen der Notiz'));
  },
};
