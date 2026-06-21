import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Order } from '@/lib/types';
import { ART, formatTimer, formatEuro } from '@/lib/art';
import { STATUS } from '@/lib/tokens';
import { offeneNotes, useStore } from '@/state/store';
import { hasOffeneZeiten } from '@/state/selectors';

export function OrderCard({ order }: { order: Order }) {
  const openCard = useStore((s) => s.openCard);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: order.id });

  const art = ART[order.artKey];
  const style = {
    transform: CSS.Translate.toString(transform),
    borderLeftColor: STATUS[order.status].color,
  };

  const timerLaufend = order.timerRunning;
  const offeneZeit = !timerLaufend && hasOffeneZeiten(order);
  const reviewCount = offeneNotes(order);

  return (
    <div
      ref={setNodeRef}
      className={`card${isDragging ? ' is-dragging' : ''}`}
      style={style}
      onClick={() => openCard(order.id)}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') openCard(order.id); }}
    >
      <div className="card__top">
        <div>
          <div className="card__mandant">{order.mandant}</div>
          <div className="card__art">{order.art}</div>
        </div>
        <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
      </div>

      <div className="chips">
        <span className="chip">Soll {order.soll} h</span>
        <span className="chip">{order.monat}</span>
        <span className="chip">{order.seiten} S.</span>
        <span className="chip">{order.kosten > 0 ? formatEuro(order.kosten) : '—'}</span>
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
    </div>
  );
}
