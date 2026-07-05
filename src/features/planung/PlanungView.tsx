import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { AlertTriangle, GripVertical } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useStore, useCurrentUser } from '@/state/store';
import { useVisibleOrders, umplanungFreiMoeglich } from '@/state/selectors';
import { rolePolicy } from '@/lib/tokens';
import { ART, formatHours, erfassteStunden, isLaufendeArt } from '@/lib/art';
import { arbeitstage, monthRange } from '@/lib/monate';
import { EMPLOYEES, DEMO_KALENDER } from '@/mock/orders';
import { API_MODE } from '@/api/mode';
import { heute } from '@/lib/heute';

/**
 * Modul „Planung": oben der Pool noch nicht geplanter Aufträge, unten ein Kalender mit der
 * Monatskapazität. Per Drag & Drop wird ein Auftrag in einen Monat gezogen — dabei werden im
 * Hintergrund Anfangs-/Enddatum gesetzt (planOrder). Zurück in den Pool hebt die Planung auf.
 *
 * Kalenderbereich: Demo-Horizont aus mock/orders.ts (ab Jahresbeginn von HEUTE); im Server-Modus
 * ab Jahresbeginn des echten heutigen Datums (in Produktion später DATEV employeecapacities).
 */
const KALENDER = API_MODE ? monthRange(Number(heute().slice(0, 4)), 0, 15) : DEMO_KALENDER;

export function PlanungView() {
  const orders = useVisibleOrders();
  const users = useStore((s) => s.users);
  const planOrder = useStore((s) => s.planOrder);
  const unplanOrder = useStore((s) => s.unplanOrder);
  const umplanen = useStore((s) => s.umplanen);
  const requestUmplanung = useStore((s) => s.requestUmplanung);
  const me = useCurrentUser();
  const istAdmin = !!me?.admin;
  const role = useStore((s) => s.role);
  // Partner/Admin verschieben frei (sie sind die freigebende Instanz); Mitarbeiter unterliegen
  // der Umplanungs-Regel — zentral über rolePolicy, wie im OrderModal.
  const darfFreiVerschieben = istAdmin || rolePolicy.canApproveUmplanung(role);

  // Nicht-Admins planen nur sich selbst; Admin wählt frei. Die Planungs-ID ist die
  // `bearbeiterId` der Aufträge: im Demo-Modus die Mock-EMPLOYEES-IDs (Zuordnung über die
  // Initialen), im Server-Modus die DATEV-Employee-ID — eigene aus `me.datevId`, die
  // Admin-Auswahl aus den sichtbaren Aufträgen (distinct Bearbeiter), bis die Nutzer-API
  // echte Mitarbeiterlisten liefert (Codex-Review P2). Ohne Treffer KEIN stiller Rückfall
  // auf einen fremden Mitarbeiter — dann bleibt die Liste leer.
  const meinEmp = me ? EMPLOYEES.find((e) => e.initials === me.initials) : undefined;
  const mitarbeiterOptionen = useMemo(() => {
    if (!API_MODE) return EMPLOYEES.map((e) => ({ id: e.id, name: e.name }));
    const map = new Map<string, string>();
    for (const o of orders) if (o.bearbeiterId) map.set(o.bearbeiterId, o.bearbeiter || o.bearbeiterId);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [orders]);
  const [adminEmpId, setAdminEmpId] = useState(API_MODE ? '' : 'sw');
  const adminId = adminEmpId || mitarbeiterOptionen[0]?.id || '';
  const empId = istAdmin ? adminId : API_MODE ? me?.datevId ?? '' : meinEmp?.id ?? '';
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Kapazitätsprofil des Ausgewählten: Demo über die Initialen des Mock-Profils, Server-Modus
  // über die DATEV-ID; ohne Treffer greifen die Defaults (echte Profile mit der Nutzer-API).
  const profil = !istAdmin ? me
    : API_MODE ? users.find((u) => u.datevId === empId)
      : users.find((u) => u.initials === EMPLOYEES.find((e) => e.id === empId)?.initials);
  const tagessoll = profil?.tagessoll ?? 8;
  const tageProWoche = profil?.arbeitstageProWoche ?? 5;
  // Monatskapazität: Tagessoll × Arbeitstage (Mo–Fr), bei Teilzeit anteilig (Tage/Woche ÷ 5).
  // Feiertage/Urlaub sind im Mock NICHT abgezogen — kommen in M2 aus DATEV (employeecapacities).
  const kapazitaet = (m: string) => Math.round(tagessoll * arbeitstage(m) * (tageProWoche / 5));

  const meine = useMemo(
    () => (empId ? orders.filter((o) => o.bearbeiterId === empId && !isLaufendeArt(o.artKey)) : []),
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
    const o = orders.find((x) => x.id === id);
    if (!o) return;

    if (overId === 'pool') {
      if (!o.monat) return; // liegt bereits im Pool
      // Zurücklegen unterliegt derselben Regel wie Umplanen — sonst wäre „Pool und neu
      // ziehen" eine Umgehung der Partner-Freigabe. Mitarbeiter: nur wenn frei möglich,
      // und es verbraucht das Freikontingent; Partner/Admin: frei (Kontingent zurückgesetzt).
      if (darfFreiVerschieben) unplanOrder(id);
      else if (umplanungFreiMoeglich(o)) unplanOrder(id, { kontingentVerbrauchen: true });
      return; // sonst: bleibt geplant (Umplanung in einen konkreten Monat anfordern)
    }
    if (!overId.startsWith('m:')) return;
    const ziel = overId.slice(2);
    if (o.monat === ziel) return;
    if (!o.monat) planOrder(id, ziel); // Erstplanung aus dem Pool (immer frei, verbraucht nichts)
    else if (darfFreiVerschieben) umplanen(id, ziel, { erzwungen: true }); // Partner/Admin: direkt (zählt wie Freigabe)
    else if (umplanungFreiMoeglich(o)) umplanen(id, ziel); // freie JA/ESt-Umplanung im VJ
    else if (rolePolicy.canRequestUmplanung(role)) requestUmplanung(id, ziel); // → Badge „Freigabe ausstehend"
  }

  return (
    <div className="placeholder">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Planung</div>
      <div className="verw-head">
        <div>
          <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Planung</h1>
          <p className="muted" style={{ margin: 0 }}>
            Nicht geplante Aufträge per Drag &amp; Drop in einen Monat ziehen — Anfangs- und
            Enddatum werden automatisch gesetzt. Kapazität = Tagessoll ({tagessoll} h) × Arbeitstage
            {tageProWoche < 5 ? ` × ${tageProWoche}/5 (Teilzeit)` : ''} (Mo–Fr, ohne Feiertage).
            Erstplanung ist frei; eine spätere Umplanung erfordert die Partner-Freigabe
            (Jahresabschluss/Einkommensteuer: 1× pro Jahr frei).
          </p>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 170 }}>
          <label>Mitarbeiter</label>
          {istAdmin ? (
            <select className="input" value={adminId} onChange={(e) => setAdminEmpId(e.target.value)}>
              {mitarbeiterOptionen.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          ) : (
            <input className="input" value={me?.name ?? ''} readOnly />
          )}
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <Pool orders={pool} />

        <div className="panel__title" style={{ marginTop: 22 }}><h4>Kalender</h4></div>
        <div className="cal-row">
          {KALENDER.map((m) => (
            <MonthCard key={m} monat={m} orders={planedFor(m)} kapazitaet={kapazitaet(m)} />
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
  const pending = o.umplanung?.freigabeAusstehend;
  return (
    <div ref={setNodeRef} className="cal-chip" style={{ opacity: isDragging ? 0.4 : undefined }} {...attributes} {...listeners}
      title={pending ? `Umplanung nach ${o.umplanung?.zielMonat} wartet auf Partner-Freigabe` : undefined}>
      <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
      <span className="cal-chip__mandant">{o.mandant}</span>
      {pending
        ? <span className="badge badge--pending cal-chip__pending">→ {o.umplanung?.zielMonat}</span>
        : <span className="muted tabular">{o.soll}h</span>}
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
