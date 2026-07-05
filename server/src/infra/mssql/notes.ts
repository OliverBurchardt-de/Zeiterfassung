import type { ConnectionPool } from 'mssql';
import { sql } from './db';
import type { Note, NoteComment, NoteKind, NoteState } from '../../domain/types';
import type { NoteRepository } from '../../domain/ports';
import { isoDateTime } from './rows';

/** DB-Zeile (dbo.notes) -> Domaenen-Note. Reine Funktion (testbar ohne DB). */
export function mapNoteRow(row: Record<string, unknown>): Note {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    kind: (row.kind === 'review' ? 'review' : 'frage') as NoteKind,
    noteState: (row.note_state === 'erledigt' || row.note_state === 'freigegeben'
      ? row.note_state
      : 'offen') as NoteState,
    text: String(row.text),
    authorId: String(row.author_id),
    createdAt: isoDateTime(row.created_at),
  };
}

export function mapNoteCommentRow(row: Record<string, unknown>): NoteComment {
  return {
    id: String(row.id),
    noteId: String(row.note_id),
    authorId: String(row.author_id),
    text: String(row.text),
    createdAt: isoDateTime(row.created_at),
  };
}

const NOTE_COLS = 'id, order_id, kind, note_state, text, author_id, created_at';
const COMMENT_COLS = 'id, note_id, author_id, text, created_at';

export function createMssqlNoteRepository(pool: ConnectionPool): NoteRepository {
  return {
    async insert(n) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), n.id)
        .input('order_id', sql.NVarChar(64), n.orderId)
        .input('kind', sql.NVarChar(10), n.kind)
        .input('note_state', sql.NVarChar(20), n.noteState)
        .input('text', sql.NVarChar(sql.MAX), n.text)
        .input('author_id', sql.NVarChar(64), n.authorId)
        .input('created_at', sql.DateTime2, new Date(n.createdAt))
        .query(
          `INSERT INTO dbo.notes (${NOTE_COLS})
           VALUES (@id, @order_id, @kind, @note_state, @text, @author_id, @created_at)`
        );
    },
    async findById(id) {
      const r = await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .query(`SELECT ${NOTE_COLS} FROM dbo.notes WHERE id = @id`);
      return r.recordset[0] ? mapNoteRow(r.recordset[0]) : undefined;
    },
    async listByOrder(orderId) {
      // Thread-Reihenfolge: aelteste zuerst.
      const r = await pool
        .request()
        .input('order_id', sql.NVarChar(64), orderId)
        .query(`SELECT ${NOTE_COLS} FROM dbo.notes WHERE order_id = @order_id ORDER BY created_at`);
      return r.recordset.map(mapNoteRow);
    },
    async update(n) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), n.id)
        .input('note_state', sql.NVarChar(20), n.noteState)
        .input('text', sql.NVarChar(sql.MAX), n.text)
        .query('UPDATE dbo.notes SET note_state = @note_state, text = @text WHERE id = @id');
    },
    async remove(id) {
      // Kommentare gehoeren zur Note — im selben Batch mit entfernen (FK).
      await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .query('DELETE FROM dbo.note_comments WHERE note_id = @id; DELETE FROM dbo.notes WHERE id = @id;');
    },
    async insertComment(c) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), c.id)
        .input('note_id', sql.NVarChar(64), c.noteId)
        .input('author_id', sql.NVarChar(64), c.authorId)
        .input('text', sql.NVarChar(sql.MAX), c.text)
        .input('created_at', sql.DateTime2, new Date(c.createdAt))
        .query(
          `INSERT INTO dbo.note_comments (${COMMENT_COLS})
           VALUES (@id, @note_id, @author_id, @text, @created_at)`
        );
    },
    async listComments(noteId) {
      const r = await pool
        .request()
        .input('note_id', sql.NVarChar(64), noteId)
        .query(`SELECT ${COMMENT_COLS} FROM dbo.note_comments WHERE note_id = @note_id ORDER BY created_at`);
      return r.recordset.map(mapNoteCommentRow);
    },
  };
}
