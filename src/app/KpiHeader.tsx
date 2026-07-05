import { useState } from 'react';
import { FilePlus2 } from 'lucide-react';
import { useFilteredOrders, kpis } from '@/state/selectors';
import { AnforderungModal } from '@/features/anforderung/AnforderungModal';

export function KpiHeader() {
  const orders = useFilteredOrders();
  const k = kpis(orders);
  const [anfOpen, setAnfOpen] = useState(false);

  return (
    <div className="pagehead">
      <div className="pagehead__title">
        <div className="eyebrow">Auftragsabwicklung</div>
        <h1>Auftrags-Board</h1>
      </div>
      <div className="pagehead__actions">
        <button className="btn btn--ghost btn--sm" onClick={() => setAnfOpen(true)}>
          <FilePlus2 size={15} /> Auftrag anfordern
        </button>
      </div>
      <div className="kpis">
        <Kpi num={k.zugeteilt} label="zugeteilt" color="var(--bk-fg-1)" />
        <Kpi num={k.inBearbeitung} label="in Bearbeitung" color="var(--bk-blue)" />
        <Kpi num={k.zeitenOffen} label="Zeiten offen" color="var(--bk-blood-orange)" />
        <Kpi num={k.reviewNotes} label="Review Notes" color="var(--bk-amber)" />
      </div>
      {anfOpen && <AnforderungModal onClose={() => setAnfOpen(false)} />}
    </div>
  );
}

function Kpi({ num, label, color }: { num: number; label: string; color: string }) {
  return (
    <div className="kpi">
      <div className="kpi__num" style={{ color }}>{num}</div>
      <div className="kpi__label">{label}</div>
    </div>
  );
}
