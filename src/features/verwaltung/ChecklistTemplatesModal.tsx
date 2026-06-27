import { useEffect, useState } from 'react';
import { X, Plus, Trash2, RotateCcw } from 'lucide-react';
import { useStore } from '@/state/store';
import { ORDERTYPES, ORDERTYPE_GROUPS } from '@/lib/ordertypes';
import { CHECKLIST_TEMPLATES_BY_ORDERTYPE } from '@/lib/checklists';

/**
 * Checklisten-Vorlagen je **konkreter Auftragsart** (Ordertype) bearbeiten: Punkte hinzufügen/
 * ändern/entfernen, neue Checkliste von Grund auf anlegen, oder auf die voreingestellte Vorlage
 * zurücksetzen. Persistiert im Store; in M2 nutzt der DATEV-Import diese Vorlagen je Auftragsart.
 */
export function ChecklistTemplatesModal({ onClose }: { onClose: () => void }) {
  const templates = useStore((s) => s.checklistTemplates);
  const addItem = useStore((s) => s.addChecklistTemplateItem);
  const editItem = useStore((s) => s.editChecklistTemplateItem);
  const removeItem = useStore((s) => s.removeChecklistTemplateItem);
  const resetTpl = useStore((s) => s.resetChecklistTemplate);

  const gruppen = ORDERTYPE_GROUPS.filter((g) => !g.internal);
  const [sel, setSel] = useState<string>(ORDERTYPES[0]?.ordertype ?? '');
  const [neu, setNeu] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = templates[sel] ?? [];
  const selInfo = ORDERTYPES.find((o) => o.ordertype === sel);
  const defaultItems = CHECKLIST_TEMPLATES_BY_ORDERTYPE[sel] ?? [];
  const istVorlage = JSON.stringify(items) === JSON.stringify(defaultItems);

  function add() {
    if (!neu.trim()) return;
    addItem(sel, neu);
    setNeu('');
  }

  return (
    <div className="overlay" style={{ zIndex: 70 }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <button className="modal__close" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
          <div className="modal__title"><h2>Checklisten verwalten</h2></div>
          <div className="modal__sub">Vorlagen je Auftragsart — bearbeiten, neu anlegen, zurücksetzen</div>
        </div>

        <div className="modal__body">
          <div className="field">
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
            <>
              {items.length === 0 && (
                <div className="muted" style={{ fontSize: 13, margin: '8px 0' }}>
                  Noch keine Punkte für „{selInfo.name}". Unten hinzufügen oder importieren.
                </div>
              )}
              {items.map((label, i) => (
                <div className="tmpl-row" key={i}>
                  <input className="input" value={label} onChange={(e) => editItem(sel, i, e.target.value)} placeholder="Checklistenpunkt …" />
                  <button className="btn btn--ghost btn--sm" onClick={() => removeItem(sel, i)} aria-label="Punkt entfernen"><Trash2 size={14} /></button>
                </div>
              ))}

              <div className="add-row" style={{ marginTop: 10 }}>
                <input
                  className="input" value={neu}
                  onChange={(e) => setNeu(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                  placeholder="Neuen Punkt hinzufügen …"
                />
                <button className="btn btn--deep btn--sm" disabled={!neu.trim()} onClick={add}><Plus size={14} /> Hinzufügen</button>
              </div>

              <div className="add-row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
                <button
                  className="btn btn--ghost btn--sm" disabled={istVorlage}
                  title={istVorlage ? 'Entspricht bereits der Vorlage' : 'Auf die voreingestellte Vorlage zurücksetzen'}
                  onClick={() => resetTpl(sel)}
                >
                  <RotateCcw size={14} /> Auf Vorlage zurücksetzen
                </button>
                <button className="btn btn--deep btn--sm" onClick={onClose}>Fertig</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
