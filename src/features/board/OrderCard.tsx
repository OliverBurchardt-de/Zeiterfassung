import { useDraggable } from '@dnd-kit/core';
import { Info, ListChecks } from 'lucide-react';
import type { Order } from '@/lib/types';
import { ART, formatTimer, formatHours, erfassteStunden, hasBesonderheiten } from '@/lib/art';
import { STATUS } from '@/lib/tokens';
import { offeneNotes, useStore, besKey } from '@/state/store';
import { hasOffeneZeiten } from '@/state/selectors';

/** Reine Darstellung einer Karte – wird sowohl im Board als auch im Drag-Overlay genutzt. */
function CardInner({ order }: { order: Order }) {
  const art = ART[order.artKey];
  const timerLaufend = order.timerRunning;
  const offeneZeit = !timerLaufend && hasOffeneZeiten(order);
  const reviewCount = offeneNotes(order);
  const openBes = useStore((s) => s.openBesonderheiten);
  const openChecklist = useStore((s) => s.openChecklist);
  const besCount = useStore((s) => (s.besonderheiten[besKey(order.mandantNr, order.artKey)] ?? []).length);
  const checkOffen = order.checklist.filter((c) => !c.done).length;
  const checkGesamt = order.checklist.length;

  return (
    <>
      <div className="card__top">
        <div>
          <div className="card__mandant">{order.mandant}</div>
          <div className="card__art">{order.art} · VJ {order.vj}</div>
        </div>
        <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
      </div>

      <div className="chips">
        <span className="chip">Soll {order.soll} h</span>
        <span className="chip">Ist {formatHours(erfassteStunden(order.times))}</span>
        <span className="chip">{order.monat}</span>
      </div>

      <div className="card__state">
        {timerLaufend && (
          <div className="state-line" style={{ color: 'var(--bk-blood-orange)', fontWeight: 600 }}>
            <span className="dot dot--pulse" style={{ background: 'var(--bk-blood-orange)' }} />
            {formatTimer(order.timerSec ?? 0)} h läuft
          </div>
        )}
        {offeneZeit && (
          <div className="state-line muted">
            <span className="dot" style={{ background: 'var(--bk-box)' }} />
            Zeit erfasst · nicht freigegeben
          </div>
        )}
        {order.umplanung?.freigabeAusstehend && (
          <div className="state-line">
            <span className="badge badge--pending">Freigabe ausstehend</span>
          </div>
        )}
        {reviewCount > 0 && (
          <div className="state-line">
            <span className="badge badge--review">{reviewCount} Review-Note{reviewCount > 1 ? 's' : ''}</span>
          </div>
        )}
        {order.times.length === 0 && !timerLaufend && order.status !== 'av' && (
          <div className="state-line muted">
            <span className="dot" style={{ background: 'var(--bk-box)' }} />
            keine Zeit erfasst
          </div>
        )}
      </div>

      {(hasBesonderheiten(order.artKey) || checkGesamt > 0) && (
        <div className="card__foot">
          {checkGesamt > 0 && (
            <button
              className="btn btn--ghost btn--sm card__bes"
              onClick={(e) => { e.stopPropagation(); openChecklist(order.id); }}
            >
              <ListChecks size={13} /> Checkliste ({checkGesamt - checkOffen}/{checkGesamt})
            </button>
          )}
          {hasBesonderheiten(order.artKey) && (
            <button
              className="btn btn--ghost btn--sm card__bes"
              onClick={(e) => { e.stopPropagation(); openBes(order); }}
            >
              <Info size={13} /> Besonderheiten{besCount > 0 ? ` (${besCount})` : ''}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** Ziehbare Karte im Board. Klick öffnet das Detail, Ziehen verschiebt den Status. */
export function OrderCard({ order }: { order: Order }) {
  const openCard = useStore((s) => s.openCard);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });

  const style = {
    borderLeftColor: STATUS[order.status].color,
    // Beim Ziehen bleibt das Original an Ort und Stelle (nur abgeblendet);
    // sichtbar bewegt wird ausschließlich das Overlay (siehe Board.tsx).
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      className="card"
      style={style}
      onClick={() => openCard(order.id)}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') openCard(order.id); }}
    >
      <CardInner order={order} />
    </div>
  );
}

/** Visuelle Kopie, die beim Ziehen dem Cursor folgt (kein Klick, kein Drag-Hook). */
export function OrderCardOverlay({ order }: { order: Order }) {
  return (
    <div className="card card--overlay" style={{ borderLeftColor: STATUS[order.status].color }}>
      <CardInner order={order} />
    </div>
  );
}
