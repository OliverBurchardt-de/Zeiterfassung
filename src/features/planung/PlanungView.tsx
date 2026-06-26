import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { AlertTriangle, GripVertical } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useStore } from '@/state/store';
import { ART, formatHours, erfassteStunden, isLaufendeArt } from '@/lib/art';
import { arbeitstage } from '@/lib/monate';
import { EMPLOYEES, DEMO_KALENDER } from '@/mock/orders';

/**
 * Modul „Planung": oben der Pool noch nicht geplanter Aufträge, unten ein Kalender mit der
 * Monatskapazität. Per Drag & Drop wird ein Auftrag in einen Monat gezogen — dabei werden im
 * Hintergrund Anfangs-/Enddatum gesetzt (planOrder). Zurück in den Pool hebt die Planung auf.
 *
 * Kalenderbereich: zentraler Demo-Horizont aus mock/orders.ts (ab Jahresbeginn von HEUTE).
 */
const KALENDER = DEMO_KALENDER;

export function PlanungView() {
  const orders = useStore((s) => s.orders);
  const users = useStore((s) => s.users);
  const planOrder = useStore((s) => s.planOrder);
  const unplanOrder = useStore((s) => s.unplanOrder);

  const [empId, setEmpId] = useState('sw');
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const emp = EMPLOYEES.find((e) => e.id === empId) ?? EMPLOYEES[0];
  const tagessoll = users.find((u) => u.initials === emp.initials)?.tagessoll ?? 8;

  const meine = useMemo(
    () => orders.filter((o) => o.bearbeiterId === empId && !isLaufendeArt(o.artKey)),
    [orders, empId],
  );
  const pool = meine.filter((o) => !o.monat);
  const planedFor = (m: string) => meine.filter((o) => o.monat === m);

  const activeOrder = orders.find((o) => o.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id ? String(e.over.id) : null;
    const id = String(e.active.id);
    if (!overId) return;
    if (overId === 'pool') unplanOrder(id);
    else if (overId.startsWith('m:')) planOrder(id, overId.slice(2));
  }

  return (
    <div className="placeholder">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Planung</div>
      <div className="verw-head">
        <div>
          <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Planung</h1>
          <p className="muted" style={{ margin: 0 }}>
            Nicht geplante Aufträge per Drag &amp; Drop in einen Monat ziehen — Anfangs- und
            Enddatum werden automatisch gesetzt. Kapazität = Tagessoll ({tagessoll} h) × Arbeitstage.
          </p>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 170 }}>
          <label>Mitarbeiter</label>
          <select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)}>
            {EMPLOYEES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <Pool orders={pool} />

        <div className="panel__title" style={{ marginTop: 22 }}><h4>Kalender</h4></div>
        <div className="cal-row">
          {KALENDER.map((m) => (
            <MonthCard key={m} monat={m} orders={planedFor(m)} kapazitaet={tagessoll * arbeitstage(m)} />
          ))}
        </div>

        <DragOverlay>{activeOrder && <DragChip order={activeOrder} />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Pool({ orders }: { orders: Order[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' });
  return (
    <div className={`panel pool${isOver ? ' is-over' : ''}`} ref={setNodeRef}>
      <div className="panel__title"><h4>Noch nicht geplante Aufträge</h4>
        <span className="count-pill" style={{ color: 'var(--bk-deep-blue)', background: 'var(--bk-blue-soft)' }}>{orders.length}</span>
      </div>
      {orders.length === 0
        ? <div className="muted" style={{ fontSize: 13 }}>Alle Aufträge dieses Mitarbeiters sind eingeplant. (Aus einem Monat hierher ziehen, um die Planung aufzuheben.)</div>
        : (
          <table className="utable pool__table">
            <thead>
              <tr><th></th><th>Auftrag</th><th>Mandant</th><th>Auftragsart</th><th>VJ</th><th className="utable__num">Planstunden</th><th className="utable__num">Ist</th></tr>
            </thead>
            <tbody>{orders.map((o) => <PoolRow key={o.id} o={o} />)}</tbody>
          </table>
        )}
    </div>
  );
}

function PoolRow({ o }: { o: Order }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: o.id });
  const art = ART[o.artKey];
  return (
    <tr ref={setNodeRef} className="pool__row" style={{ opacity: isDragging ? 0.4 : undefined }} {...attributes} {...listeners}>
      <td className="pool__grip"><GripVertical size={15} /></td>
      <td className="tabular">{o.auftragsNr}</td>
      <td className="pool__mandant">{o.mandant}</td>
      <td><span className="art-badge" style={{ background: art.color }}>{art.label}</span> {o.art}</td>
      <td className="tabular">{o.vj}</td>
      <td className="utable__num tabular">{o.soll} h</td>
      <td className="utable__num tabular">{formatHours(erfassteStunden(o.times))}</td>
    </tr>
  );
}

function MonthCard({ monat, orders, kapazitaet }: { monat: string; orders: Order[]; kapazitaet: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `m:${monat}` });
  const geplant = orders.reduce((sum, o) => sum + o.soll, 0);
  const pct = kapazitaet > 0 ? Math.round((geplant / kapazitaet) * 100) : 0;
  const over = geplant > kapazitaet;
  const stufe = over ? 'over' : pct >= 90 ? 'warn' : 'ok';

  return (
    <div ref={setNodeRef} className={`cal-card${isOver ? ' is-over' : ''}`}>
      <div className="cal-card__month">{monat}</div>
      <div className="cal-card__kap">{formatHours(kapazitaet)}<span className="cal-card__unit"> Kapazität</span></div>
      <div className={`cal-card__plan cal-card__plan--${stufe}`}>
        {over && <AlertTriangle size={13} />} {formatHours(geplant)} geplant
      </div>
      <div className="plan-bar"><div className={`plan-bar__fill plan-bar__fill--${stufe}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <div className="cal-card__orders">
        {orders.map((o) => <PlannedChip key={o.id} o={o} />)}
      </div>
    </div>
  );
}

function PlannedChip({ o }: { o: Order }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: o.id });
  const art = ART[o.artKey];
  return (
    <div ref={setNodeRef} className="cal-chip" style={{ opacity: isDragging ? 0.4 : undefined }} {...attributes} {...listeners}>
      <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
      <span className="cal-chip__mandant">{o.mandant}</span>
      <span className="muted tabular">{o.soll}h</span>
    </div>
  );
}

function DragChip({ order }: { order: Order }) {
  const art = ART[order.artKey];
  return (
    <div className="cal-chip cal-chip--drag">
      <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
      <span className="cal-chip__mandant">{order.mandant}</span>
      <span className="muted tabular">{order.soll}h</span>
    </div>
  );
}
