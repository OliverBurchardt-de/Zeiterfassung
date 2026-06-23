import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { useStore } from '@/state/store';
import type { Order } from '@/lib/types';

/** Bearbeitbarer Inhalt der Auftrags-Checkliste — geteilt von Modal und Karten-Flyout. */
export function ChecklistBody({ order }: { order: Order }) {
  const toggleCheck = useStore((s) => s.toggleCheck);
  const addCheck = useStore((s) => s.addCheck);
  const removeCheck = useStore((s) => s.removeCheck);
  const [draft, setDraft] = useState('');

  const gesamt = order.checklist.length;

  function add() {
    if (draft.trim()) {
      addCheck(order.id, draft.trim());
      setDraft('');
    }
  }

  return (
    <>
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
    </>
  );
}
