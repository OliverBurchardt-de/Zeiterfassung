import { useMemo, useState } from 'react';
import type { Order } from '@/lib/types';
import { useStore } from '@/state/store';
import { useVisibleOrders } from '@/state/selectors';
import { ART, formatHours, erfassteStunden, artNeedsNotiz, isLaufendeArt, AUFWANDSARTEN, needsAufwandsart, TIME_STATUS } from '@/lib/art';
import { rolePolicy } from '@/lib/tokens';
import type { Aufwandsart } from '@/lib/types';
import { HEUTE } from '@/mock/orders';

/**
 * Modul „Laufende Buchungen": Auftragsarten ohne Status-Flow (Laufende Steuerberatung,
 * Mehraufwand). Pro Mandant ein Block, in dem nur Zeit gebucht wird — mit Pflicht-Notiz.
 * Sichtbarkeit wie überall: nur die für den angemeldeten Nutzer sichtbaren Aufträge.
 */
export function LaufendeView() {
  const orders = useVisibleOrders();

  const byMandant = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders) {
      if (!isLaufendeArt(o.artKey)) continue;
      const list = map.get(o.mandant) ?? [];
      list.push(o);
      map.set(o.mandant, list);
    }
    return Array.from(map.entries());
  }, [orders]);

  return (
    <div className="placeholder">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Zeiterfassung</div>
      <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Laufende Buchungen</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Beratungsleistungen und Mehraufwand werden hier laufend gebucht — ohne Status-Ablauf.
        Eine Notiz ist bei diesen Aufträgen Pflicht.
      </p>

      <div className="laufende">
        {byMandant.map(([mandant, list]) => (
          <div className="panel" key={mandant}>
            <div className="panel__title"><h4>{mandant}</h4></div>
            {list.map((o) => <LaufendeOrder key={o.id} order={o} />)}
          </div>
        ))}
        {byMandant.length === 0 && <div className="panel"><p className="muted">Keine laufenden Aufträge.</p></div>}
      </div>
    </div>
  );
}

function LaufendeOrder({ order }: { order: Order }) {
  const role = useStore((s) => s.role);
  const darfFreigeben = rolePolicy.canReleaseOwnTime(role);
  const addManual = useStore((s) => s.addManualTime);
  const releaseTime = useStore((s) => s.releaseTime);
  const withdrawTime = useStore((s) => s.withdrawTime);

  const [dauer, setDauer] = useState('');
  const [notiz, setNotiz] = useState('');
  const [aufwandsart, setAufwandsart] = useState<Aufwandsart | ''>('');

  const art = ART[order.artKey];
  const pflicht = artNeedsNotiz(order.artKey);
  const needsAuf = needsAufwandsart(order.artKey);
  const notizOk = !pflicht || notiz.trim().length > 0;
  const aufOk = !needsAuf || aufwandsart !== '';
  const gesamt = erfassteStunden(order.times);

  function submit() {
    const v = parseFloat(dauer.replace(',', '.'));
    if (!isNaN(v) && v > 0 && notizOk && aufOk) {
      addManual(order.id, HEUTE, v, notiz, aufwandsart || undefined);
      setDauer('');
      setNotiz('');
      setAufwandsart('');
    }
  }

  return (
    <div className="laufende-order">
      <div className="laufende-order__head">
        <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
        <span className="laufende-order__art">{order.art}</span>
        <span className="muted laufende-order__sum">{formatHours(gesamt)} gebucht</span>
      </div>

      <div className="times-list">
        {order.times.length === 0 && <div className="muted">Noch keine Zeiten gebucht.</div>}
        {order.times.map((t) => (
          <div key={t.id} className="time-entry">
            <div className="time-row">
              <span>{new Date(t.datum).toLocaleDateString('de-DE')}</span>
              <span className="tabular">{formatHours(t.dauer)}</span>
              <span className={`badge ${TIME_STATUS[t.status].badge}`}>{TIME_STATUS[t.status].label}</span>
              {darfFreigeben && t.status === 'erfasst' && (
                <button className="btn btn--success btn--sm" onClick={() => releaseTime(order.id, t.id)}>Freigeben</button>
              )}
              {darfFreigeben && t.status === 'freigegeben' && (
                <button className="btn btn--ghost btn--sm" onClick={() => withdrawTime(order.id, t.id)}>Zurückziehen</button>
              )}
            </div>
            {(t.notiz || t.aufwandsart) && (
              <div className="time-row__notiz">
                {t.aufwandsart && (
                  <span className="auf-tag">{AUFWANDSARTEN.find((a) => a.key === t.aufwandsart)?.label}</span>
                )}
                {t.notiz}
              </div>
            )}
          </div>
        ))}
      </div>

      {needsAuf && (
        <div className="field" style={{ marginTop: 12, marginBottom: 8 }}>
          <label>Aufwandsart (Pflicht)</label>
          <select
            className="input"
            value={aufwandsart}
            onChange={(e) => setAufwandsart(e.target.value as Aufwandsart | '')}
          >
            <option value="">— bitte wählen —</option>
            {AUFWANDSARTEN.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          {!aufOk && dauer.trim() !== '' && (
            <div className="hint" style={{ color: 'var(--bk-blood-orange)' }}>
              Bitte Mehraufwand oder „Dumm gelaufen" wählen.
            </div>
          )}
        </div>
      )}

      <div className="field" style={{ marginTop: needsAuf ? 0 : 12, marginBottom: 8 }}>
        <label>Notiz{pflicht ? ' (Pflicht)' : ' (optional)'}</label>
        <textarea
          className="input"
          rows={2}
          placeholder="Worauf bezieht sich die Leistung? …"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
        />
        {pflicht && !notizOk && dauer.trim() !== '' && (
          <div className="hint" style={{ color: 'var(--bk-blood-orange)' }}>
            Bei dieser Auftragsart ist eine Notiz erforderlich.
          </div>
        )}
      </div>
      <div className="add-row">
        <input
          className="input"
          placeholder="Stunden (z. B. 1,5)"
          value={dauer}
          onChange={(e) => setDauer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <button className="btn btn--deep btn--sm" disabled={!notizOk || !aufOk} onClick={submit}>Zeit buchen</button>
      </div>
    </div>
  );
}
