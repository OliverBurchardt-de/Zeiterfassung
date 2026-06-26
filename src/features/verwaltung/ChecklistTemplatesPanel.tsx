import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/state/store';
import { ORDERTYPES, ORDERTYPE_GROUPS } from '@/lib/ordertypes';

/**
 * Verwaltung der Checklisten-Vorlagen je **konkreter Auftragsart** (Ordertype). Auswahl der
 * Auftragsart oben, darunter die Punkte mit Bearbeiten/Entfernen/Hinzufügen. Persistiert im Store;
 * in M2 nutzt der DATEV-Import diese Vorlagen pro Ordertype.
 */
export function ChecklistTemplatesPanel() {
  const templates = useStore((s) => s.checklistTemplates);
  const addItem = useStore((s) => s.addChecklistTemplateItem);
  const editItem = useStore((s) => s.editChecklistTemplateItem);
  const removeItem = useStore((s) => s.removeChecklistTemplateItem);

  // Auftragsarten gruppiert (interne Gruppen 9/10 ausblenden)
  const gruppen = ORDERTYPE_GROUPS.filter((g) => !g.internal);
  const [sel, setSel] = useState<string>(ORDERTYPES[0]?.ordertype ?? '');
  const [neu, setNeu] = useState('');

  const items = templates[sel] ?? [];
  const selInfo = ORDERTYPES.find((o) => o.ordertype === sel);

  function add() {
    if (!neu.trim()) return;
    addItem(sel, neu);
    setNeu('');
  }

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div className="panel__title"><h4>Checklisten-Vorlagen je Auftragsart</h4></div>
      <div className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        Pro Auftragsart pflegbar. Ein Auftrag kann erst auf „Erledigt" gesetzt werden, wenn alle
        Punkte erledigt sind. In M2 übernimmt der DATEV-Import diese Vorlagen je Auftragsart.
      </div>

      <div className="field" style={{ maxWidth: 460 }}>
        <label>Auftragsart</label>
        <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
          {gruppen.map((g) => (
            <optgroup key={g.id} label={`${g.id} · ${g.name}`}>
              {ORDERTYPES.filter((o) => o.groupId === g.id).map((o) => (
                <option key={o.ordertype} value={o.ordertype}>
                  {o.ordertype} — {o.name} ({(templates[o.ordertype] ?? []).length})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selInfo && (
        <div className="tmpl">
          {items.length === 0 && (
            <div className="muted" style={{ fontSize: 13, margin: '8px 0' }}>
              Noch keine Punkte für „{selInfo.name}". Unten hinzufügen.
            </div>
          )}
          {items.map((label, i) => (
            <div className="tmpl-row" key={i}>
              <input
                className="input"
                value={label}
                onChange={(e) => editItem(sel, i, e.target.value)}
                placeholder="Checklistenpunkt …"
              />
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => removeItem(sel, i)}
                aria-label="Punkt entfernen"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <div className="add-row" style={{ marginTop: 10 }}>
            <input
              className="input"
              value={neu}
              onChange={(e) => setNeu(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              placeholder="Neuen Punkt hinzufügen …"
            />
            <button className="btn btn--deep btn--sm" disabled={!neu.trim()} onClick={add}>
              <Plus size={14} /> Hinzufügen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
