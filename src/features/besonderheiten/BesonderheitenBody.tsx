import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore, besKey, useCurrentUser } from '@/state/store';

/**
 * Bearbeitbarer Inhalt der Mandantenbesonderheiten — geteilt von Modal und Karten-Flyout.
 * Inhalte hängen am Schlüssel Mandant + Ordertype (period-übergreifend wiederverwendet).
 */
export function BesonderheitenBody({ mandantNr, ordertype }: { mandantNr: string; ordertype: string }) {
  const key = besKey(mandantNr, ordertype);
  const all = useStore((s) => s.besonderheiten);
  const add = useStore((s) => s.addBesonderheit);
  const edit = useStore((s) => s.editBesonderheit);
  const remove = useStore((s) => s.removeBesonderheit);
  const me = useCurrentUser();
  const [draft, setDraft] = useState('');

  const items = all[key] ?? [];

  function submit() {
    if (draft.trim()) {
      add(key, draft.trim(), me?.name ?? 'Unbekannt');
      setDraft('');
    }
  }

  return (
    <>
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
    </>
  );
}
