import { useRef, useState } from 'react';
import { Trash2, Paperclip, X } from 'lucide-react';
import type { Order, Note, Attachment } from '@/lib/types';
import { useStore, noteOffen, useCurrentUser } from '@/state/store';
import { NOTE_KIND, NOTE_STATE, notePolicy, colors } from '@/lib/tokens';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Max. Dateigröße je Anhang im Mock: Anhänge werden als data-URL im Browser-Speicher
 * (localStorage) persistiert — Object-URLs wären nach einem Reload tote Links und
 * würden Speicher leaken. Echte Datei-Ablage (Storage + Prüfung) kommt in M2.
 */
const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;

function fileToAttachment(f: File): Promise<Attachment | null> {
  if (f.size > MAX_ATTACHMENT_BYTES) return Promise.resolve(null);
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve({ id: crypto.randomUUID(), name: f.name, size: f.size, url: String(r.result) });
    r.onerror = () => resolve(null);
    r.readAsDataURL(f);
  });
}

/** Button mit verstecktem Datei-Input; zu große Dateien werden mit Hinweis übersprungen. */
function AttachButton({ onFiles, label }: { onFiles: (a: Attachment[]) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [skipped, setSkipped] = useState(0);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          void Promise.all(files.map(fileToAttachment)).then((list) => {
            const atts = list.filter((a): a is Attachment => a !== null);
            setSkipped(files.length - atts.length);
            if (atts.length) onFiles(atts);
          });
          if (ref.current) ref.current.value = '';
        }}
      />
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={() => ref.current?.click()}
      >
        <Paperclip size={14} /> {label}
      </button>
      {skipped > 0 && (
        <span className="hint" style={{ color: 'var(--bk-blood-orange)' }}>
          {skipped} Datei{skipped > 1 ? 'en' : ''} übersprungen (max. 1,5 MB je Datei im Prototyp)
        </span>
      )}
    </>
  );
}

function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove?: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="note__files">
      {items.map((a) => (
        <span className="attach-chip" key={a.id}>
          <Paperclip size={13} />
          <a href={a.url} download={a.name}>{a.name}</a>
          <span className="attach-chip__size">{formatSize(a.size)}</span>
          {onRemove && (
            <button className="attach-chip__x" onClick={() => onRemove(a.id)} aria-label="Anhang entfernen">
              <X size={12} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

export function NotesSection({ order }: { order: Order }) {
  const role = useStore((s) => s.role);
  const addNote = useStore((s) => s.addNote);

  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const me = useCurrentUser();
  const author = me?.name ?? order.partner;

  const offen = order.notes.filter(noteOffen).length;
  const erledigt = order.notes.length - offen;

  // Rolle bestimmt den Typ der neu angelegten Note (frage = MA, review = Partner)
  const eigenerKind = notePolicy.canCreateKind(role);

  function submit() {
    if (draft.trim() || pending.length) {
      addNote(order.id, draft.trim() || '(ohne Text)', role, author, pending);
      setDraft('');
      setPending([]);
    }
  }

  return (
    <section className="notes-section">
      <div className="notes-section__head">
        <h3>Review Notes &amp; Fragen</h3>
        <span className="muted">{offen} offen · {erledigt} erledigt</span>
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
          <AttachButton onFiles={(a) => setPending((p) => [...p, ...a])} label="Datei" />
          <button className="btn btn--deep" onClick={submit}>Anlegen</button>
        </div>
        <AttachmentList items={pending} onRemove={(id) => setPending((p) => p.filter((a) => a.id !== id))} />
        <div className="hint">
          {role === 'partner'
            ? 'Als Partner legst du Review Notes an und gibst sie nach Bearbeitung frei. Dateien lassen sich anhängen.'
            : 'Als Mitarbeiter legst du Fragen / Hinweise an, schließt sie selbst (ohne Freigabe) und kannst Dateien anhängen.'}
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
  const addAttachments = useStore((s) => s.addAttachments);
  const removeAttachment = useStore((s) => s.removeAttachment);

  const [comment, setComment] = useState('');
  const me = useCurrentUser();
  const author = me?.name ?? order.partner;

  const isFrage = note.kind === 'frage';
  // Nur Review-Notes werden vom Partner freigegeben und sind danach gesperrt.
  const locked = note.kind === 'review' && note.noteState === 'freigegeben';
  const kindMeta = NOTE_KIND[note.kind];
  // Eine erledigte Frage ist abgeschlossen (kein „wartet auf Freigabe").
  const stateMeta = isFrage && note.noteState === 'erledigt'
    ? { label: 'Erledigt', color: colors.success, soft: colors.successSoft }
    : NOTE_STATE[note.noteState];

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
          {notePolicy.canDelete(role, note.kind) && (
            <button className="icon-btn" onClick={() => deleteNote(order.id, note.id)} aria-label="Eintrag löschen">
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

      <AttachmentList
        items={note.attachments}
        onRemove={!locked ? (id) => removeAttachment(order.id, note.id, id) : undefined}
      />

      {!locked && (
        <div className="note__actions">
          <input
            className="input"
            placeholder={isFrage ? 'Rückfrage / Kommentar …' : 'Kommentar hinzufügen …'}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
          />
          <button className="btn btn--ghost btn--sm" onClick={submitComment}>Kommentar</button>

          {notePolicy.canAttach(role) && (
            <AttachButton onFiles={(a) => addAttachments(order.id, note.id, a)} label="Datei anhängen" />
          )}

          {/* offen -> erledigt: Mitarbeiter (Frage selbst schließen / Review als erledigt melden) */}
          {note.noteState === 'offen' && notePolicy.canMarkDone(role) && (
            <button className="btn btn--blue btn--sm" onClick={() => setNoteState(order.id, note.id, 'erledigt')}>
              {isFrage ? 'Als erledigt markieren' : 'Als erledigt melden'}
            </button>
          )}

          {/* Frage: erledigt -> offen wieder aufnehmen (Mitarbeiter) */}
          {isFrage && note.noteState === 'erledigt' && notePolicy.canReopenFrage(role) && (
            <button className="btn btn--ghost btn--sm" onClick={() => setNoteState(order.id, note.id, 'offen')}>
              Wieder aufnehmen
            </button>
          )}

          {/* Review: Partner-Freigabe (nur nachdem der Mitarbeiter „erledigt" gemeldet hat) + zurück an Mitarbeiter */}
          {note.kind === 'review' && note.noteState === 'erledigt' && notePolicy.canApprove(role, note.kind) && (
            <button className="btn btn--success btn--sm" onClick={() => setNoteState(order.id, note.id, 'freigegeben')}>
              Freigeben
            </button>
          )}
          {note.kind === 'review' && note.noteState === 'erledigt' && notePolicy.canApprove(role, note.kind) && (
            <button className="btn btn--ghost btn--sm" onClick={() => setNoteState(order.id, note.id, 'offen')}>
              Zurück an Mitarbeiter
            </button>
          )}
        </div>
      )}

      {/* Freigegebene Review-Note: Partner kann wieder öffnen */}
      {locked && notePolicy.canApprove(role, note.kind) && (
        <div className="note__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setNoteState(order.id, note.id, 'offen')}>
            Wieder öffnen
          </button>
        </div>
      )}
    </div>
  );
}
