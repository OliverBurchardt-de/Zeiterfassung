import { useState } from 'react';
import { X, Info, ListChecks, Clock } from 'lucide-react';
import { useStore } from '@/state/store';
import { STATUS, STATUS_ORDER, type StatusId } from '@/lib/tokens';
import { ART, formatHours, erfassteStunden } from '@/lib/art';
import { hasUnterlagenProzess, hasBesonderheiten, isLaufendeArt, hasTeilauftraege } from '@/lib/art';
import type { Order } from '@/lib/types';
import { TimePanel } from '@/features/time/TimePanel';
import { QuickTimeDialog } from '@/features/time/QuickTimeDialog';
import { NotesSection } from '@/features/notes/NotesSection';
import { canComplete, offeneChecklist } from '@/state/selectors';

const MONATE = ['Jan 2025', 'Feb 2025', 'Mär 2025', 'Apr 2025', 'Mai 2025', 'Jun 2025'];

export function OrderModal({ orderId }: { orderId: string }) {
  const order = useStore((s) => s.orders.find((o) => o.id === orderId));
  const closeCard = useStore((s) => s.closeCard);
  const setStatus = useStore((s) => s.setStatus);
  const requestUmplanung = useStore((s) => s.requestUmplanung);
  const openBes = useStore((s) => s.openBesonderheiten);
  const openChecklist = useStore((s) => s.openChecklist);

  const [zielMonat, setZielMonat] = useState('Apr 2025');
  const [quickOpen, setQuickOpen] = useState(false);

  if (!order) return null;
  const art = ART[order.artKey];
  const statusMeta = STATUS[order.status];
  const erfasst = erfassteStunden(order.times);
  const pct = order.soll > 0 ? Math.min(100, Math.round((erfasst / order.soll) * 100)) : 0;
  const rest = Math.max(0, order.soll - erfasst);

  const statusListe = STATUS_ORDER.filter((s) => {
    if ((s === 'ua' || s === 'uv') && !hasUnterlagenProzess(order.artKey)) return false;
    return true;
  });

  // „Erledigt" ist erst möglich, wenn die Checkliste vollständig ist
  const offenCheck = offeneChecklist(order);
  const erledigtGesperrt = !canComplete(order);

  return (
    <div className="overlay" onClick={closeCard}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <button className="modal__close" onClick={closeCard} aria-label="Schließen"><X size={18} /></button>
          <div className="modal__title">
            <h2>{order.mandant}</h2>
            <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
            <span className="status-pill" style={{ color: statusMeta.color, background: statusMeta.soft }}>
              <span className="dot" style={{ background: statusMeta.color }} />
              {statusMeta.label}
            </span>
          </div>
          <div className="modal__sub">
            {order.art} · VJ {order.vj}
            <span className="modal__sub-actions">
              {order.checklist.length > 0 && (
                <button className="btn btn--ghost btn--sm modal__chip-btn" onClick={() => openChecklist(order.id)}>
                  <ListChecks size={13} /> Checkliste ({order.checklist.length - offenCheck}/{order.checklist.length})
                </button>
              )}
              {hasBesonderheiten(order.artKey) && (
                <button className="btn btn--ghost btn--sm modal__chip-btn" onClick={() => openBes(order)}>
                  <Info size={13} /> Besonderheiten
                </button>
              )}
              {!isLaufendeArt(order.artKey) && (
                <button className="btn btn--ghost btn--sm modal__chip-btn" onClick={() => setQuickOpen(true)}>
                  <Clock size={13} /> Laufende Zeit buchen
                </button>
              )}
            </span>
          </div>
          <div className="meta">
            <Meta label="Auftrags-Nr." value={order.auftragsNr} />
            <Meta label="Mandanten-Nr." value={order.mandantNr} />
            <Meta label="Veranlagungsjahr" value={String(order.vj)} />
            <Meta label="Geplanter Monat" value={order.monat} />
            <Meta label="Verantw. Partner" value={order.partner} />
            <Meta label="Bearbeiter" value={order.bearbeiter} />
          </div>
        </div>

        <div className="modal__body">
          <div className="statusbar">
            <div className="statusbar__label">Status ändern</div>
            <div className="status-pills">
              {statusListe.map((s) => {
                const active = s === order.status;
                const m = STATUS[s];
                const gesperrt = s === 'er' && erledigtGesperrt;
                return (
                  <button
                    key={s}
                    className={`status-opt${active ? ' is-active' : ''}`}
                    style={active ? { background: m.color } : undefined}
                    disabled={gesperrt}
                    title={gesperrt ? 'Erst möglich, wenn die Checkliste vollständig ist' : undefined}
                    onClick={() => setStatus(order.id, s as StatusId)}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            {erledigtGesperrt && (
              <div className="hint">
                „Erledigt" erst möglich, wenn die Checkliste vollständig ist (noch {offenCheck} offen).
              </div>
            )}
          </div>

          <div className="hours">
            <div className="progress"><div className={`progress__fill${pct >= 100 ? ' is-done' : ''}`} style={{ width: `${pct}%` }} /></div>
            <div className="hours__text">
              <b>{formatHours(erfasst)}</b> erfasst / {order.soll} h Soll · noch {formatHours(rest)}
            </div>
          </div>

          <div className="grid-2">
            <div>
              <div className="subhead">Plandaten für den Monat</div>
              <div className="field">
                <label>Geplanter Zeitraum (aus DATEV EO)</label>
                <div className="date-range">
                  <input className="input" type="date" defaultValue={order.fristStart} />
                  <span>→</span>
                  <input className="input" type="date" defaultValue={order.fristEnde} />
                </div>
                <div className="hint">ergibt Monat: {order.monat}</div>
              </div>
              <div className="field">
                <label>Soll-Stunden</label>
                <input className="input" type="number" defaultValue={order.soll} />
              </div>
              <div className="field">
                <label>Ist-Stunden</label>
                <input className="input" value={formatHours(erfasst)} readOnly />
                <div className="hint">Summe der erfassten Zeiten</div>
              </div>

              <div className="field">
                <label>Umplanung in anderen Monat</label>
                {order.umplanung?.freigabeAusstehend ? (
                  <span className="badge badge--pending">Freigabe ausstehend → {order.umplanung.zielMonat}</span>
                ) : (
                  <div className="date-range">
                    <select className="input" value={zielMonat} onChange={(e) => setZielMonat(e.target.value)}>
                      {MONATE.map((m) => <option key={m}>{m}</option>)}
                    </select>
                    <button className="btn btn--amber btn--sm" onClick={() => requestUmplanung(order.id, zielMonat)}>
                      Freigabe anfordern
                    </button>
                  </div>
                )}
                <div className="hint">Umplanung erfordert die Freigabe des mandatsverantwortlichen Partners.</div>
              </div>
            </div>

            <TimePanel order={order} />
          </div>

          {hasTeilauftraege(order.artKey) && order.suborders && <TeilauftragPanel order={order} />}

          <NotesSection order={order} />
        </div>
      </div>

      {quickOpen && <QuickTimeDialog order={order} onClose={() => setQuickOpen(false)} />}
    </div>
  );
}

/** Monats-Teilaufträge (FiBu/Lohn) — Klick schaltet „erledigt" (DATEV: date_work_completed). */
function TeilauftragPanel({ order }: { order: Order }) {
  const setDone = useStore((s) => s.setSuborderDone);
  const subs = order.suborders ?? [];
  const erledigt = subs.filter((s) => s.erledigtAm).length;

  return (
    <div className="tl">
      <div className="subhead">Teilaufträge (Monate) · {erledigt}/{subs.length} erledigt</div>
      <div className="tl-grid">
        {subs.map((sb) => {
          const done = !!sb.erledigtAm;
          return (
            <button
              key={sb.id}
              className={`tl-cell${done ? ' tl-cell--done' : ''}`}
              onClick={() => setDone(order.id, sb.id, !done)}
              title={done ? `erledigt am ${new Date(sb.erledigtAm!).toLocaleDateString('de-DE')}` : 'als erledigt markieren'}
            >
              <div className="tl-cell__m">{sb.monat.split(' ')[0]}</div>
              <div className="tl-cell__h">{formatHours(sb.erfasst)} / {sb.soll} h</div>
              <div className="tl-cell__s">{done ? 'erledigt' : 'offen'}</div>
            </button>
          );
        })}
      </div>
      <div className="hint">Klick schaltet „erledigt" (DATEV: date_work_completed). Zeitbuchung je Monat folgt in M2.</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta__item">
      <span className="meta__label">{label}</span>
      <span className="meta__value">{value}</span>
    </div>
  );
}
