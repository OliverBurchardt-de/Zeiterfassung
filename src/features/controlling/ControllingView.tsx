import { AlertTriangle, Gauge, Receipt } from 'lucide-react';
import type { Order } from '@/lib/types';
import { ART, formatHours, erfassteStunden, isLaufendeArt } from '@/lib/art';
import { STATUS } from '@/lib/tokens';
import { istUeberfaellig, istNichtAbgerechnet, auslastungPct, useVisibleOrders } from '@/state/selectors';
import { heute } from '@/lib/heute';

/**
 * Modul „Controlling" — Auftragsüberwachung für Partner/Leitung:
 * überfällige Aufträge, Planwert-Ausschöpfung und noch nicht abgerechnete Aufträge.
 */
export function ControllingView() {
  const orders = useVisibleOrders().filter((o) => !isLaufendeArt(o.artKey));

  const ueberfaellig = orders.filter(istUeberfaellig);
  const planwert = orders.filter((o) => auslastungPct(o) >= 0.8).sort((a, b) => auslastungPct(b) - auslastungPct(a));
  const nichtAbgerechnet = orders.filter(istNichtAbgerechnet);

  return (
    <div className="placeholder">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Controlling</div>
      <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Controlling</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Auftragsüberwachung zum Stichtag {new Date(heute()).toLocaleDateString('de-DE')}.
      </p>

      <div className="ctrl-kpis">
        <Kpi icon={<AlertTriangle size={18} />} tone="warn" value={ueberfaellig.length} label="Überfällig" />
        <Kpi icon={<Gauge size={18} />} tone="over" value={orders.filter((o) => auslastungPct(o) > 1).length} label="Planwert überschritten" />
        <Kpi icon={<Receipt size={18} />} tone="blue" value={nichtAbgerechnet.length} label="Nicht abgerechnet" />
      </div>

      <Section title="Überfällige Aufträge" hint="Fristende vor dem Stichtag und noch nicht erledigt.">
        {ueberfaellig.length === 0
          ? <Empty text="Keine überfälligen Aufträge." />
          : ueberfaellig.map((o) => (
              <Row key={o.id} o={o}>
                <span className="badge badge--notok">Frist {new Date(o.fristEnde).toLocaleDateString('de-DE')}</span>
              </Row>
            ))}
      </Section>

      <Section title="Planwerte erreicht / überschritten" hint="Erfasste Stunden ≥ 80 % der Soll-Stunden.">
        {planwert.length === 0
          ? <Empty text="Keine Aufträge nahe am Planwert." />
          : planwert.map((o) => {
              const pct = Math.round(auslastungPct(o) * 100);
              const over = pct > 100;
              return (
                <Row key={o.id} o={o}>
                  <span className="muted tabular">{formatHours(erfassteStunden(o.times))} / {o.soll} h</span>
                  <span className={`badge ${over ? 'badge--notok' : 'badge--ok'}`}>{pct} %</span>
                </Row>
              );
            })}
      </Section>

      <Section
        title="Noch nicht abgerechnet"
        hint={'Aufträge ohne DATEV-Status „Fakturiert", auf denen bereits Buchungen liegen. Wird im Hintergrund per DATEV-Pull ermittelt (M2) — keine manuelle Pflege.'}
      >
        {nichtAbgerechnet.length === 0
          ? <Empty text="Keine offenen, abrechenbaren Buchungen." />
          : nichtAbgerechnet.map((o) => (
              <Row key={o.id} o={o}>
                <span className="muted tabular">{formatHours(erfassteStunden(o.times))} gebucht</span>
              </Row>
            ))}
      </Section>
    </div>
  );
}

function Kpi({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
  return (
    <div className={`ctrl-kpi ctrl-kpi--${tone}`}>
      <div className="ctrl-kpi__icon">{icon}</div>
      <div>
        <div className="ctrl-kpi__value">{value}</div>
        <div className="ctrl-kpi__label">{label}</div>
      </div>
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

function Row({ o, children }: { o: Order; children: React.ReactNode }) {
  const art = ART[o.artKey];
  const st = STATUS[o.status];
  return (
    <div className="ctrl-row">
      <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
      <span className="ctrl-row__mandant">{o.mandant}</span>
      <span className="muted ctrl-row__meta">{o.monat || 'ungeplant'} · {o.bearbeiter}</span>
      <span className="status-pill" style={{ color: st.color, background: st.soft }}>
        <span className="dot" style={{ background: st.color }} />{st.label}
      </span>
      <span className="ctrl-row__right">{children}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="muted" style={{ fontSize: 13 }}>{text}</div>;
}
