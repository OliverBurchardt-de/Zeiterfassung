import { useFilteredOrders, kpis } from '@/state/selectors';

export function KpiHeader() {
  const orders = useFilteredOrders();
  const k = kpis(orders);

  return (
    <div className="pagehead">
      <div className="pagehead__title">
        <div className="eyebrow">Auftragsabwicklung</div>
        <h1>Auftrags-Board</h1>
      </div>
      <div className="kpis">
        <Kpi num={k.zugeteilt} label="zugeteilt" color="var(--bk-fg-1)" />
        <Kpi num={k.inBearbeitung} label="in Bearbeitung" color="var(--bk-blue)" />
        <Kpi num={k.zeitenOffen} label="Zeiten offen" color="var(--bk-blood-orange)" />
        <Kpi num={k.reviewNotes} label="Review Notes" color="var(--bk-amber)" />
      </div>
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
