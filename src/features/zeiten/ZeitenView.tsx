import { useMemo } from 'react';
import type { Order } from '@/lib/types';
import { useStore } from '@/state/store';
import { ART, formatHours, isLaufendeArt, AUFWANDSARTEN, TIME_STATUS } from '@/lib/art';
import { STATUS } from '@/lib/tokens';
import { zeitenVon, ohneZeit } from '@/state/selectors';
import { CURRENT_USER } from '@/mock/orders';

/**
 * Modul „Meine Zeiten" — persönliche Zeitübersicht des angemeldeten Mitarbeiters. Hier gibt der
 * Mitarbeiter seine eigenen Zeiten frei (keine Partner-Freigabe): nur freigegebene/übertragene
 * Zeiten gehen in den DATEV-Sync. Außerdem: eigene Aufträge ohne erfasste Zeit.
 */
export function ZeitenView() {
  const orders = useStore((s) => s.orders);
  const role = useStore((s) => s.role);
  const releaseTime = useStore((s) => s.releaseTime);
  const withdrawTime = useStore((s) => s.withdrawTime);
  const alle = useMemo(() => zeitenVon(orders, CURRENT_USER.name), [orders]);

  const offen = alle.filter((z) => z.time.status === 'erfasst');
  const frei = alle.filter((z) => z.time.status !== 'erfasst');
  const summeOffen = offen.reduce((s, z) => s + z.time.dauer, 0);
  const summeGesamt = alle.reduce((s, z) => s + z.time.dauer, 0);
  const darfFreigeben = role === 'mitarbeiter';

  const ohne = orders.filter((o) => o.bearbeiter === CURRENT_USER.name && !isLaufendeArt(o.artKey) && ohneZeit(o));

  return (
    <div className="placeholder">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Zeiterfassung</div>
      <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Meine Zeiten</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Übersicht für {CURRENT_USER.name}: <b>{formatHours(summeGesamt)}</b> erfasst, davon
        <b> {formatHours(summeOffen)}</b> noch nicht freigegeben.
      </p>

      <Section title="Nicht freigegebene Zeiten" hint="Von dir noch freizugeben — erst danach Übertragung nach DATEV.">
        {offen.length === 0 ? <Empty text="Alles freigegeben." /> : offen.map(({ order, time }) => (
          <Row key={time.id} o={order}>
            {time.aufwandsart && <span className="auf-tag">{AUFWANDSARTEN.find((a) => a.key === time.aufwandsart)?.label}</span>}
            <span className="muted tabular">{new Date(time.datum).toLocaleDateString('de-DE')} · {formatHours(time.dauer)}</span>
            <span className={`badge ${TIME_STATUS.erfasst.badge}`}>{TIME_STATUS.erfasst.label}</span>
            {darfFreigeben && <button className="btn btn--success btn--sm" onClick={() => releaseTime(order.id, time.id)}>Freigeben</button>}
          </Row>
        ))}
      </Section>

      <Section title="Aufträge ohne erfasste Zeit" hint="In Bearbeitung, aber noch keine Zeit gebucht (späterer Reminder-Auslöser).">
        {ohne.length === 0 ? <Empty text="Keine offenen Aufträge ohne Zeit." /> : ohne.map((o) => (
          <Row key={o.id} o={o}><span className="muted tabular">{o.soll} h Soll</span></Row>
        ))}
      </Section>

      <Section title="Freigegebene Zeiten" hint="Freigegeben und bereit zur Übertragung nach DATEV (bzw. bereits übertragen).">
        {frei.length === 0 ? <Empty text="Noch keine freigegebenen Zeiten." /> : frei.map(({ order, time }) => (
          <Row key={time.id} o={order}>
            <span className="muted tabular">{new Date(time.datum).toLocaleDateString('de-DE')} · {formatHours(time.dauer)}</span>
            <span className={`badge ${TIME_STATUS[time.status].badge}`}>{TIME_STATUS[time.status].label}</span>
            {darfFreigeben && time.status === 'freigegeben' && (
              <button className="btn btn--ghost btn--sm" onClick={() => withdrawTime(order.id, time.id)}>Zurückziehen</button>
            )}
          </Row>
        ))}
      </Section>
    </div>
  );
}

function Row({ o, children }: { o: Order; children: React.ReactNode }) {
  const art = ART[o.artKey];
  const st = STATUS[o.status];
  return (
    <div className="ctrl-row">
      <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
      <span className="ctrl-row__mandant">{o.mandant}</span>
      <span className="muted ctrl-row__meta">{isLaufendeArt(o.artKey) ? o.art : o.monat || 'ungeplant'}</span>
      {!isLaufendeArt(o.artKey) && (
        <span className="status-pill" style={{ color: st.color, background: st.soft }}>
          <span className="dot" style={{ background: st.color }} />{st.label}
        </span>
      )}
      <span className="ctrl-row__right">{children}</span>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel__title"><h4>{title}</h4></div>
      <div className="hint" style={{ marginTop: 0, marginBottom: 10 }}>{hint}</div>
      <div className="ctrl-rows">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="muted" style={{ fontSize: 13 }}>{text}</div>;
}
