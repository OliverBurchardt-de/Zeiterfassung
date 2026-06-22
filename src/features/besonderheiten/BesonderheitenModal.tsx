import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useStore, besKey } from '@/state/store';
import { ART } from '@/lib/art';
import { CURRENT_USER } from '@/mock/orders';

/**
 * Dialog für Mandantenbesonderheiten. Inhalte hängen am Schlüssel Mandant + Auftragsart und
 * werden dadurch automatisch von den Aufträgen der Folgeperioden (Jahr/Monat) wiederverwendet.
 */
export function BesonderheitenModal() {
  const ctx = useStore((s) => s.besOpen);
  const close = useStore((s) => s.closeBesonderheiten);
  const all = useStore((s) => s.besonderheiten);
  const add = useStore((s) => s.addBesonderheit);
  const edit = useStore((s) => s.editBesonderheit);
  const remove = useStore((s) => s.removeBesonderheit);

  const [draft, setDraft] = useState('');

  if (!ctx) return null;
  const key = besKey(ctx.mandantNr, ctx.artKey);
  const items = all[key] ?? [];
  const art = ART[ctx.artKey];

  function submit() {
    if (draft.trim()) {
      add(key, draft.trim(), CURRENT_USER.name);
      setDraft('');
    }
  }

  return (
    <div className="overlay" style={{ zIndex: 70 }} onClick={close}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <button className="modal__close" onClick={close} aria-label="Schließen"><X size={18} /></button>
          <div className="modal__title">
            <h2>Besonderheiten</h2>
            <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
          </div>
          <div className="modal__sub">{ctx.mandant} · {ctx.art}</div>
        </div>

        <div className="modal__body">
          <div className="hint" style={{ marginBottom: 14 }}>
            Besonderheiten gelten je Mandant und Auftragsart und werden automatisch auf die
            Aufträge der Folgeperioden (Jahr bzw. Monat) übernommen.
          </div>

          {items.length === 0 && <div className="muted">Noch keine Besonderheiten erfasst.</div>}
          {items.map((b) => (
            <div className="bes-item" key={b.id}>
              <textarea
                className="input bes-item__text"
                rows={2}
                value={b.text}
                onChange={(e) => edit(key, b.id, e.target.value)}
              />
              <div className="bes-item__row">
                <span className="muted bes-item__meta">{b.author} · {new Date(b.datum).toLocaleDateString('de-DE')}</span>
                <button className="icon-btn" onClick={() => remove(key, b.id)} aria-label="Besonderheit löschen">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          <div className="add-row" style={{ marginTop: 14 }}>
            <input
              className="input"
              placeholder="Besonderheit hinzufügen …"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <button className="btn btn--deep btn--sm" onClick={submit}>Hinzufügen</button>
          </div>
        </div>
      </div>
    </div>
  );
}
