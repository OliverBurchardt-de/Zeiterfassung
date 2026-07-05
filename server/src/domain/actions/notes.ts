import type { PublicUser, Note, NoteComment } from '../types';
import type { Repositories } from '../ports';
import type { Clock } from '../clock';
import type { RequireVisibleOrder } from './access';
import { DomainError } from '../errors';
import { notePolicy } from '../notePolicy';

export interface CreateNoteInput {
  orderId: string;
  text: string;
}

/** Note-Kopf zusammen mit seinen Kommentaren (Thread-Sicht). */
export interface NoteThread extends Note {
  comments: NoteComment[];
}

/**
 * Note-Aktionen (Review-Notes/Fragen) — serverseitig verbindlich ueber notePolicy.
 * Art der Note ergibt sich aus der Rolle (Partner -> review, sonst frage).
 */
export function createNoteActions(repos: Repositories, clock: Clock, requireVisibleOrder: RequireVisibleOrder) {
  /**
   * Laedt die Note UND erzwingt Sichtbarkeit ihres Auftrags — sonst koennte man ueber eine
   * (aus der ebenfalls abgesicherten Liste) bekannte Note-ID fremde Mandats-Threads mutieren
   * (Review-Befund 4). 404-Semantik des Guards verraet auch die Auftrags-Existenz nicht.
   */
  async function loadVisible(actor: PublicUser, id: string): Promise<Note> {
    const note = await repos.notes.findById(id);
    if (!note) throw new DomainError('not_found', 'Note nicht gefunden');
    await requireVisibleOrder(actor, note.orderId);
    return note;
  }

  return {
    async createNote(actor: PublicUser, input: CreateNoteInput): Promise<Note> {
      await requireVisibleOrder(actor, input.orderId);
      const text = input.text.trim();
      if (!text) throw new DomainError('invalid', 'Text darf nicht leer sein');
      const note: Note = {
        id: clock.newId(),
        orderId: input.orderId,
        kind: notePolicy.kindFor(actor.role),
        noteState: 'offen',
        text,
        authorId: actor.id,
        createdAt: clock.now(),
      };
      await repos.notes.insert(note);
      return note;
    },

    async editText(actor: PublicUser, id: string, text: string): Promise<Note> {
      if (!notePolicy.canEditText(actor.role)) throw new DomainError('forbidden', 'Bearbeiten nicht erlaubt');
      const trimmed = text.trim();
      if (!trimmed) throw new DomainError('invalid', 'Text darf nicht leer sein');
      const note = await loadVisible(actor, id);
      const next: Note = { ...note, text: trimmed };
      await repos.notes.update(next);
      return next;
    },

    /** offen -> erledigt (Mitarbeiter: Frage schliessen bzw. Review als erledigt melden). */
    async markDone(actor: PublicUser, id: string): Promise<Note> {
      if (!notePolicy.canMarkDone(actor.role)) throw new DomainError('forbidden', 'nur Mitarbeiter');
      const note = await loadVisible(actor, id);
      if (note.noteState !== 'offen') throw new DomainError('conflict', 'Note ist nicht offen');
      const next: Note = { ...note, noteState: 'erledigt' };
      await repos.notes.update(next);
      return next;
    },

    /** erledigt -> offen, nur fuer eine Frage (Rueckfrage/wieder aufnehmen). */
    async reopen(actor: PublicUser, id: string): Promise<Note> {
      const note = await loadVisible(actor, id);
      if (note.kind !== 'frage' || !notePolicy.canReopenFrage(actor.role)) {
        throw new DomainError('forbidden', 'nur der Mitarbeiter kann eine Frage wieder aufnehmen');
      }
      if (note.noteState !== 'erledigt') throw new DomainError('conflict', 'Note ist nicht erledigt');
      const next: Note = { ...note, noteState: 'offen' };
      await repos.notes.update(next);
      return next;
    },

    /** erledigt -> freigegeben (nur Partner, nur Review-Note). */
    async approve(actor: PublicUser, id: string): Promise<Note> {
      const note = await loadVisible(actor, id);
      if (!notePolicy.canApprove(actor.role, note.kind)) {
        throw new DomainError('forbidden', 'nur der Partner gibt Review-Notes frei');
      }
      if (note.noteState !== 'erledigt') throw new DomainError('conflict', 'Note ist nicht erledigt');
      const next: Note = { ...note, noteState: 'freigegeben' };
      await repos.notes.update(next);
      return next;
    },

    async comment(actor: PublicUser, id: string, text: string): Promise<NoteComment> {
      if (!notePolicy.canComment(actor.role)) throw new DomainError('forbidden', 'Kommentieren nicht erlaubt');
      const trimmed = text.trim();
      if (!trimmed) throw new DomainError('invalid', 'Kommentar darf nicht leer sein');
      await loadVisible(actor, id); // sichert Existenz + Sichtbarkeit des Auftrags
      const comment: NoteComment = {
        id: clock.newId(),
        noteId: id,
        authorId: actor.id,
        text: trimmed,
        createdAt: clock.now(),
      };
      await repos.notes.insertComment(comment);
      return comment;
    },

    async deleteNote(actor: PublicUser, id: string): Promise<void> {
      const note = await loadVisible(actor, id);
      if (!notePolicy.canDelete(actor.role, note.kind)) {
        throw new DomainError('forbidden', 'Loeschen nicht erlaubt');
      }
      await repos.notes.remove(id);
    },

    async listByOrder(actor: PublicUser, orderId: string): Promise<NoteThread[]> {
      await requireVisibleOrder(actor, orderId);
      const notes = await repos.notes.listByOrder(orderId);
      return Promise.all(
        notes.map(async (n) => ({ ...n, comments: await repos.notes.listComments(n.id) }))
      );
    },
  };
}

export type NoteActions = ReturnType<typeof createNoteActions>;
