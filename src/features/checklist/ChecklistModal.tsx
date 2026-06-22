import { useState } from 'react';
import { X, Plus, Trash2, Check } from 'lucide-react';
import { useStore } from '@/state/store';
import { ART } from '@/lib/art';
import { offeneChecklist } from '@/state/selectors';

/** Eigenes Panel für die Auftrags-Checkliste (vor „Erledigt"). */
export function ChecklistModal() {
  const id = useStore((s) => s.checklistOpenId);
  const order = useStore((s) => s.orders.find((o) => o.id === id));
  const close = useStore((s) => s.closeChecklist);
  const toggleCheck = useStore((s) => s.toggleCheck);
  const addCheck = useStore((s) => s.addCheck);
  const removeCheck = useStore((s) => s.removeCheck);

  const [draft, setDraft] = useState('');

  if (!order) return null;
  const art = ART[order.artKey];
  const offen = offeneChecklist(order);
  const gesamt = order.checklist.length;

  function add() {
    if (draft.trim() && order) {
      addCheck(order.id, draft.trim());
      setDraft('');
    }
  }

  return (
    <div className="overlay" style={{ zIndex: 70 }} onClick={close}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <button className="modal__close" onClick={close} aria-label="Schließen"><X size={18} /></button>
          <div className="modal__title">
            <h2>Checkliste</h2>
            <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
            <span className="muted">{gesamt - offen}/{gesamt} erledigt</span>
          </div>
          <div className="modal__sub">{order.mandant} · {order.art}</div>
        </div>

        <div className="modal__body">
          <div className="hint" style={{ marginBottom: 14 }}>
            Alle Punkte müssen erledigt sein, bevor der Auftrag auf „Erledigt" gestellt werden kann.
          </div>

          {gesamt === 0 && <div className="muted">Noch keine Checklistenpunkte.</div>}
          {order.checklist.map((c) => (
            <div key={c.id} className="check-item">
              <button
                className={`checkbox${c.done ? ' is-on' : ''}`}
                onClick={() => toggleCheck(order.id, c.id)}
                aria-label="abhaken"
              >
                {c.done && <Check size={13} strokeWidth={3} />}
              </button>
              <span className={`check-item__label${c.done ? ' is-done' : ''}`}>{c.label}</span>
              <button className="icon-btn" onClick={() => removeCheck(order.id, c.id)} aria-label="löschen">
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <div className="add-row" style={{ marginTop: 12 }}>
            <input
              className="input"
              placeholder="Position hinzufügen …"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            />
            <button className="btn btn--deep btn--sm" onClick={add}><Plus size={14} /> Hinzufügen</button>
          </div>
        </div>
      </div>
    </div>
  );
}
