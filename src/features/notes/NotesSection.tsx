import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Order, Note } from '@/lib/types';
import { useStore } from '@/state/store';
import { NOTE_KIND, NOTE_STATE, notePolicy } from '@/lib/tokens';
import { CURRENT_USER } from '@/mock/orders';

export function NotesSection({ order }: { order: Order }) {
  const role = useStore((s) => s.role);
  const addNote = useStore((s) => s.addNote);

  const [draft, setDraft] = useState('');
  const author = role === 'partner' ? order.partner : CURRENT_USER.name;

  const offen = order.notes.filter((n) => n.noteState !== 'freigegeben').length;
  const freigegeben = order.notes.filter((n) => n.noteState === 'freigegeben').length;

  // Rolle bestimmt den Typ der neu angelegten Note (frage = MA, review = Partner)
  const eigenerKind = notePolicy.canCreateKind(role);

  function submit() {
    if (draft.trim()) {
      addNote(order.id, draft.trim(), role, author);
      setDraft('');
    }
  }

  return (
    <section className="notes-section">
      <div className="notes-section__head">
        <h3>Review Notes</h3>
        <span className="muted">{offen} offen · {freigegeben} freigegeben</span>
      </div>

      {order.notes.map((n) => (
        <NoteCard key={n.id} order={order} note={n} />
      ))}
      {order.notes.length === 0 && <div className="muted" style={{ marginBottom: 12 }}>Noch keine Review Notes oder Fragen.</div>}

      <div className="note-compose">
        <div className="note-compose__type">
          <span className="section-label">Typ:</span>
          {(['frage', 'review'] as const).map((k) => (
            <span
              key={k}
              className={`type-pill${k === eigenerKind ? '' : ' is-disabled'}`}
              style={{ color: NOTE_KIND[k].color, background: NOTE_KIND[k].soft }}
            >
              {NOTE_KIND[k].label}
            </span>
          ))}
        </div>
        <div className="add-row">
          <input
            className="input"
            placeholder={role === 'partner' ? 'Review Note für den Mitarbeiter …' : 'Frage / Hinweis an den Partner …'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
          <button className="btn btn--deep" onClick={submit}>Anlegen</button>
        </div>
        <div className="hint">
          {role === 'partner'
            ? 'Als Partner legst du Review Notes an und kannst Notes freigeben oder zurückgeben.'
            : 'Als Mitarbeiter legst du Fragen / Hinweise an und meldest Notes als erledigt.'}
        </div>
      </div>
    </section>
  );
}

function NoteCard({ order, note }: { order: Order; note: Note }) {
  const role = useStore((s) => s.role);
  const editText = useStore((s) => s.editNoteText);
  const addComment = useStore((s) => s.addComment);
  const setNoteState = useStore((s) => s.setNoteState);
  const deleteNote = useStore((s) => s.deleteNote);

  const [comment, setComment] = useState('');
  const author = role === 'partner' ? order.partner : CURRENT_USER.name;

  const locked = note.noteState === 'freigegeben';
  const stateMeta = NOTE_STATE[note.noteState];
  const kindMeta = NOTE_KIND[note.kind];

  function submitComment() {
    if (comment.trim()) {
      addComment(order.id, note.id, comment.trim(), role, author);
      setComment('');
    }
  }

  return (
    <div className={`note ${note.noteState === 'offen' ? 'note--offen' : ''}${locked ? ' note--locked' : ''}`}>
      <div className="note__head">
        <span className="dot" style={{ background: stateMeta.color, marginTop: 6 }} />
        <textarea
          className="note__text"
          value={note.text}
          readOnly={locked}
          onChange={(e) => editText(order.id, note.id, e.target.value)}
        />
        <div className="note__badges">
          <span className="type-pill" style={{ color: kindMeta.color, background: kindMeta.soft }}>{kindMeta.label}</span>
          <span className="type-pill" style={{ color: stateMeta.color, background: stateMeta.soft }}>{stateMeta.label}</span>
          {notePolicy.canDelete(role) && (
            <button className="icon-btn" onClick={() => deleteNote(order.id, note.id)} aria-label="Note löschen">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="note__author">von {note.author}</div>

      {note.comments.length > 0 && (
        <div className="note__thread">
          {note.comments.map((c) => (
            <div key={c.id}>
              <div className={`comment__author comment__author--${c.role}`}>{c.author}</div>
              <div className="comment__text">{c.text}</div>
            </div>
          ))}
        </div>
      )}

      {!locked && (
        <div className="note__actions">
          <input
            className="input"
            placeholder="Kommentar hinzufügen …"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
          />
          <button className="btn btn--ghost btn--sm" onClick={submitComment}>Kommentar</button>

          {/* Mitarbeiter: offen -> erledigt */}
          {note.noteState === 'offen' && notePolicy.canMarkDone(role) && (
            <button className="btn btn--blue btn--sm" onClick={() => setNoteState(order.id, note.id, 'erledigt')}>
              Als erledigt melden
            </button>
          )}
          {/* Partner: freigeben + zurück an Mitarbeiter */}
          {notePolicy.canApprove(role) && (
            <button className="btn btn--success btn--sm" onClick={() => setNoteState(order.id, note.id, 'freigegeben')}>
              Freigeben
            </button>
          )}
          {note.noteState === 'erledigt' && notePolicy.canApprove(role) && (
            <button className="btn btn--ghost btn--sm" onClick={() => setNoteState(order.id, note.id, 'offen')}>
              Zurück an Mitarbeiter
            </button>
          )}
        </div>
      )}

      {/* Freigegebene Note: Partner kann wieder öffnen */}
      {locked && notePolicy.canApprove(role) && (
        <div className="note__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setNoteState(order.id, note.id, 'offen')}>
            Wieder öffnen
          </button>
        </div>
      )}
    </div>
  );
}
