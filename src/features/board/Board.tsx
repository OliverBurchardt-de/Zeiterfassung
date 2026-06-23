import { useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, pointerWithin,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { STATUS, STATUS_ORDER, type StatusId } from '@/lib/tokens';
import { useStore } from '@/state/store';
import { useFilteredOrders, canComplete } from '@/state/selectors';
import { hasUnterlagenProzess } from '@/lib/art';
import type { Order } from '@/lib/types';
import { OrderCard, OrderCardOverlay } from './OrderCard';

export function Board() {
  const orders = useFilteredOrders();
  const setStatus = useStore((s) => s.setStatus);
  const openCard = useStore((s) => s.openCard);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Spalten ua/uv nur, wenn mind. ein sichtbarer Auftrag einen Unterlagen-Prozess hat
  const zeigeUnterlagen = orders.some((o) => hasUnterlagenProzess(o.artKey));
  const columns = STATUS_ORDER.filter((s) => {
    if ((s === 'ua' || s === 'uv') && !zeigeUnterlagen) return false;
    return true;
  });

  const byStatus = (s: StatusId) => orders.filter((o) => o.status === s);
  const activeOrder = orders.find((o) => o.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const target = String(overId) as StatusId;
    const order = orders.find((o) => o.id === String(e.active.id));
    if (!order || order.status === target) return;
    // „Erledigt" nur bei vollständiger Checkliste — sonst Karte öffnen, damit der Grund sichtbar ist
    if (target === 'er' && !canComplete(order)) {
      openCard(order.id);
      return;
    }
    setStatus(order.id, target);
  }

  return (
    <div className="board-wrap">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="board">
          {columns.map((s) => (
            <Column key={s} status={s} orders={byStatus(s)} />
          ))}
        </div>
        <DragOverlay>{activeOrder && <OrderCardOverlay order={activeOrder} />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ status, orders }: { status: StatusId; orders: Order[] }) {
  const meta = STATUS[status];
  // Die ganze Spalte ist Drop-Ziel (nicht nur die Karten-Liste), damit auch Kopf/Leerraum zählen.
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section ref={setNodeRef} className={`column${isOver ? ' is-over' : ''}`}>
      <div className="column__accent" style={{ background: meta.color }} />
      <div className="column__head">
        <span className="dot" style={{ background: meta.color }} />
        <span className="column__title">{meta.label}</span>
        <span className="count-pill" style={{ color: meta.color, background: meta.soft }}>{orders.length}</span>
      </div>
      {meta.special && <div className="column__hint">nur best. Auftragsarten</div>}
      <div className="column__list">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </div>
    </section>
  );
}
