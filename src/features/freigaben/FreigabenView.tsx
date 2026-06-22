import { Clock, CalendarClock, MessageSquare } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useStore } from '@/state/store';
import { ART, formatHours, isLaufendeArt } from '@/lib/art';
import { AUFWANDSARTEN } from '@/lib/art';
import { STATUS } from '@/lib/tokens';
import { offeneZeitFreigaben, offeneUmplanungen, offeneReviewFreigaben } from '@/state/selectors';

/**
 * Modul „Freigaben" — Cockpit des mandatsverantwortlichen Partners: alle offenen Freigaben an
 * einer Stelle (Zeiten, Umplanungen, Review-Notes). Die Aktionen sind dieselben wie in den
 * Detail-Dialogen (approveTime / approveUmplanung / setNoteState).
 */
export function FreigabenView() {
  const orders = useStore((s) => s.orders);
  const role = useStore((s) => s.role);
  const approveTime = useStore((s) => s.approveTime);
  const approveUmplanung = useStore((s) => s.approveUmplanung);
  const setNoteState = useStore((s) => s.setNoteState);

  const zeiten = offeneZeitFreigaben(orders);
  const umplan = offeneUmplanungen(orders);
  const reviews = offeneReviewFreigaben(orders);

  const nurPartner = role !== 'partner';

  return (
    <div className="placeholder">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Partner</div>
      <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Freigaben</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Offene Freigaben des mandatsverantwortlichen Partners an einer Stelle.
        {nurPartner && ' Zum Freigeben oben rechts in die Rolle „Partner" wechseln.'}
      </p>

      <div className="ctrl-kpis">
        <Kpi icon={<Clock size={18} />} tone="warn" value={zeiten.length} label="Zeiten" />
        <Kpi icon={<CalendarClock size={18} />} tone="blue" value={umplan.length} label="Umplanungen" />
        <Kpi icon={<MessageSquare size={18} />} tone="over" value={reviews.length} label="Review-Notes" />
      </div>

      <Section title="Zeit-Freigaben" hint="Erfasste, noch nicht freigegebene Zeitbuchungen.">
        {zeiten.length === 0 ? <Empty text="Keine offenen Zeiten." /> : zeiten.map(({ order, time }) => (
          <div className="ctrl-row" key={time.id}>
            <RowHead o={order} />
            <span className="ctrl-row__right">
              {time.aufwandsart && <span className="auf-tag">{AUFWANDSARTEN.find((a) => a.key === time.aufwandsart)?.label}</span>}
              <span className="muted tabular">{new Date(time.datum).toLocaleDateString('de-DE')} · {formatHours(time.dauer)}</span>
              <button className="btn btn--success btn--sm" disabled={nurPartner} onClick={() => approveTime(order.id, time.id)}>Freigeben</button>
            </span>
          </div>
        ))}
      </Section>

      <Section title="Umplanungs-Freigaben" hint="Verschiebung in einen anderen Monat — wartet auf Freigabe.">
        {umplan.length === 0 ? <Empty text="Keine offenen Umplanungen." /> : umplan.map((order) => (
          <div className="ctrl-row" key={order.id}>
            <RowHead o={order} />
            <span className="ctrl-row__right">
              <span className="badge badge--pending">{order.monat || 'ungeplant'} → {order.umplanung?.zielMonat}</span>
              <button className="btn btn--success btn--sm" disabled={nurPartner} onClick={() => approveUmplanung(order.id)}>Freigeben</button>
            </span>
          </div>
        ))}
      </Section>

      <Section title="Review-Notes zur Freigabe" hint={'Vom Mitarbeiter als „erledigt" gemeldet.'}>
        {reviews.length === 0 ? <Empty text="Keine Review-Notes offen." /> : reviews.map(({ order, note }) => (
          <div className="ctrl-row" key={note.id}>
            <RowHead o={order} />
            <span className="ctrl-row__note">{note.text}</span>
            <span className="ctrl-row__right">
              <button className="btn btn--ghost btn--sm" disabled={nurPartner} onClick={() => setNoteState(order.id, note.id, 'offen')}>Zurück</button>
              <button className="btn btn--success btn--sm" disabled={nurPartner} onClick={() => setNoteState(order.id, note.id, 'freigegeben')}>Freigeben</button>
            </span>
          </div>
        ))}
      </Section>
    </div>
  );
}

function RowHead({ o }: { o: Order }) {
  const art = ART[o.artKey];
  const st = STATUS[o.status];
  return (
    <>
      <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
      <span className="ctrl-row__mandant">{o.mandant}</span>
      <span className="muted ctrl-row__meta">{o.bearbeiter}{isLaufendeArt(o.artKey) ? ' · laufend' : ` · ${o.monat || 'ungeplant'}`}</span>
      {!isLaufendeArt(o.artKey) && (
        <span className="status-pill" style={{ color: st.color, background: st.soft }}>
          <span className="dot" style={{ background: st.color }} />{st.label}
        </span>
      )}
    </>
  );
}

function Kpi({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
  return (
    <div className={`ctrl-kpi ctrl-kpi--${tone}`}>
      <div className="ctrl-kpi__icon">{icon}</div>
      <div><div className="ctrl-kpi__value">{value}</div><div className="ctrl-kpi__label">{label}</div></div>
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
