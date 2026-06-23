import { X } from 'lucide-react';
import { useStore } from '@/state/store';
import { ART } from '@/lib/art';
import { offeneChecklist } from '@/state/selectors';
import { ChecklistBody } from './ChecklistBody';

/** Eigenes Panel für die Auftrags-Checkliste (vor „Erledigt"). */
export function ChecklistModal() {
  const id = useStore((s) => s.checklistOpenId);
  const order = useStore((s) => s.orders.find((o) => o.id === id));
  const close = useStore((s) => s.closeChecklist);

  if (!order) return null;
  const art = ART[order.artKey];
  const offen = offeneChecklist(order);
  const gesamt = order.checklist.length;

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
          <ChecklistBody order={order} />
        </div>
      </div>
    </div>
  );
}
