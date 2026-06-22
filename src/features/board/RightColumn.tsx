import { useStore, offeneNotes } from '@/state/store';
import { useFilteredOrders, heuteErfasst, hasOffeneZeiten, ohneZeit, TAGES_SOLL } from '@/state/selectors';
import { formatHours } from '@/lib/art';

export function RightColumn() {
  const orders = useFilteredOrders();
  const openCard = useStore((s) => s.openCard);

  const { gesamt, perMandant } = heuteErfasst(orders);
  const pct = Math.min(100, Math.round((gesamt / TAGES_SOLL) * 100));
  const rest = Math.max(0, TAGES_SOLL - gesamt);

  const offene = orders.filter((o) => hasOffeneZeiten(o) || ohneZeit(o));
  const mitNotes = orders.filter((o) => offeneNotes(o) > 0);

  return (
    <aside className="col-right">
      <div className="panel">
        <div className="panel__title"><h4>Heute erfasst</h4></div>
        <div>
          <span className="today-num">{gesamt.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
          <span className="muted"> / {TAGES_SOLL.toLocaleString('de-DE', { minimumFractionDigits: 1 })} h Soll</span>
        </div>
        <div className="progress"><div className={`progress__fill${pct >= 100 ? ' is-done' : ''}`} style={{ width: `${pct}%` }} /></div>
        <div className="muted">noch {formatHours(rest)} bis zum Tagessoll</div>
        <div style={{ marginTop: 10 }}>
          {perMandant.map((m) => (
            <div key={m.mandant} className="list-row">
              <span>{m.mandant}</span>
              <span>{formatHours(m.stunden)}</span>
            </div>
          ))}
          {perMandant.length === 0 && <div className="muted">Noch nichts erfasst.</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel__title">
          <span className="dot" style={{ background: 'var(--bk-blood-orange)' }} />
          <h4>Offene Zeiten</h4>
        </div>
        {offene.map((o) => (
          <div key={o.id} className="list-row link-row" onClick={() => openCard(o.id)}>
            <span>{o.mandant}</span>
            <span style={{ color: 'var(--bk-blood-orange)' }}>{ohneZeit(o) ? 'keine Zeit' : 'nicht freigegeben'}</span>
          </div>
        ))}
        {offene.length === 0 && <div className="muted">Keine offenen Zeiten.</div>}
        <div className="hint">Wird in festen Intervallen per E-Mail an den Bearbeiter gemeldet.</div>
      </div>

      <div className="panel">
        <div className="panel__title">
          <span className="dot" style={{ background: 'var(--bk-amber)' }} />
          <h4>Review Notes</h4>
        </div>
        {mitNotes.map((o) => (
          <div key={o.id} className="list-row link-row" onClick={() => openCard(o.id)}>
            <span>{o.mandant} · {o.art}</span>
            <span style={{ color: 'var(--bk-amber-ink)' }}>{offeneNotes(o)} offen</span>
          </div>
        ))}
        {mitNotes.length === 0 && <div className="muted">Keine offenen Review Notes.</div>}
      </div>
    </aside>
  );
}
