import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Order, TimeEntry } from '@/lib/types';
import { useStore, useCurrentUser } from '@/state/store';
import { useVisibleOrders, istEigeneZeit } from '@/state/selectors';
import { ART, formatHours, erfassteStunden, artNeedsNotiz, AUFWANDSARTEN, needsAufwandsart, TIME_STATUS } from '@/lib/art';
import { verhaltenFor } from '@/lib/ordertypes';
import { rolePolicy } from '@/lib/tokens';
import type { Aufwandsart } from '@/lib/types';
import { heute } from '@/lib/heute';

/**
 * Modul „Buchungen": Zeiterfassung für alles, was NICHT im Planungs-Board liegt
 * (Entscheidung 15.07.2026, docs/zeiterfassung-board-konzept.md §1):
 *  - LAUFENDE Aufträge (Laufende Steuerberatung, Mehraufwand) — Zeit mit Pflicht-Notiz.
 *  - SONSTIGE Aufträge (Anträge, Außenprüfungen, Prüfung von Steuerbescheiden …) — ebenfalls
 *    bebuchbar, damit keine Zeit verloren geht; mit Suchfeld, da es viele sein können.
 * Sichtbarkeit wie überall: nur die für den angemeldeten Nutzer sichtbaren Aufträge.
 * (Die tagesorientierte Timeline-Sicht — Zeiterfassungs-Board — folgt als eigenes Feature.)
 */
export function LaufendeView() {
  const orders = useVisibleOrders();
  const [suche, setSuche] = useState('');

  const gruppiert = (liste: Order[]): Array<[string, Order[]]> => {
    const map = new Map<string, Order[]>();
    for (const o of liste) {
      const list = map.get(o.mandant) ?? [];
      list.push(o);
      map.set(o.mandant, list);
    }
    return Array.from(map.entries());
  };

  // EINE Suche über beide Abschnitte — nach Mandant, Mandantennummer, Auftrag oder Art
  // (Feedback 15.07.2026: ohne Suche findet man in den Buchungen nichts).
  const passtZurSuche = (o: Order): boolean => {
    const q = suche.trim().toLowerCase();
    if (!q) return true;
    return `${o.mandant} ${o.mandantNr} ${o.auftragsNr} ${o.art}`.toLowerCase().includes(q);
  };
  const laufende = useMemo(
    () => gruppiert(orders.filter((o) => verhaltenFor(o.ordertype) === 'laufend' && passtZurSuche(o))),
    [orders, suche], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const sonstige = useMemo(
    () => gruppiert(orders.filter((o) => verhaltenFor(o.ordertype) === 'sonstige' && passtZurSuche(o))),
    [orders, suche], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="placeholder">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Zeiterfassung</div>
      <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Buchungen</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Zeiterfassung für Aufträge außerhalb der Planung: laufende Leistungen (mit Pflicht-Notiz)
        und sonstige aktive Aufträge.
      </p>
      <div className="field" style={{ maxWidth: 420, marginBottom: 20 }}>
        <input
          className="input"
          placeholder="Mandant, Mandantennr. oder Auftrag suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          aria-label="Buchungen durchsuchen"
        />
      </div>

      <h2 style={{ fontSize: 'var(--bk-fs-h2)', marginBottom: 4 }}>Laufende Buchungen</h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        Beratungsleistungen und Mehraufwand — eine Notiz ist bei diesen Aufträgen Pflicht.
      </p>
      <div className="laufende">
        {laufende.map(([mandant, list]) => (
          <div className="panel" key={mandant}>
            <div className="panel__title"><h4>{mandant}</h4></div>
            {list.map((o) => <LaufendeOrder key={o.id} order={o} />)}
          </div>
        ))}
        {laufende.length === 0 && (
          <div className="panel"><p className="muted">{suche.trim() ? 'Keine Treffer.' : 'Keine laufenden Aufträge.'}</p></div>
        )}
      </div>

      <h2 style={{ fontSize: 'var(--bk-fs-h2)', marginTop: 32, marginBottom: 4 }}>Sonstige Aufträge</h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        Aktive Aufträge außerhalb der Planung (z. B. Anträge, Außenprüfungen, Prüfung von
        Steuerbescheiden). Zeiten werden hier gebucht und wie üblich nach Freigabe übertragen.
      </p>
      <div className="laufende">
        {sonstige.map(([mandant, list]) => (
          <div className="panel" key={mandant}>
            <div className="panel__title"><h4>{mandant}</h4></div>
            {list.map((o) => <LaufendeOrder key={o.id} order={o} />)}
          </div>
        ))}
        {sonstige.length === 0 && (
          <div className="panel">
            <p className="muted">{suche.trim() ? 'Keine Treffer.' : 'Keine sonstigen Aufträge.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LaufendeOrder({ order }: { order: Order }) {
  const role = useStore((s) => s.role);
  const me = useCurrentUser();
  // Wie im TimePanel: Bedienen nur an eigenen Einträgen (Zeit-Ownership, Server erzwingt das).
  const darfBedienen = (t: TimeEntry) =>
    rolePolicy.canReleaseOwnTime(role) && !!me && istEigeneZeit(t, order, me);
  const addManual = useStore((s) => s.addManualTime);
  const releaseTime = useStore((s) => s.releaseTime);
  const withdrawTime = useStore((s) => s.withdrawTime);
  const deleteTime = useStore((s) => s.deleteTime);

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
      // Arbeitsdatum = heute() — Demo: Stichtag HEUTE, Server-Modus: echtes Tagesdatum.
      addManual(order.id, heute(), v, notiz, aufwandsart || undefined);
      setDauer('');
      setNotiz('');
      setAufwandsart('');
    }
  }

  return (
    <div className="laufende-order">
      <div className="laufende-order__head">
        <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
        {/* Auftragsnummer + VJ zur Unterscheidung — je Mandant können mehrere gleichartige liegen. */}
        <span className="laufende-order__art">{order.art} · {order.auftragsNr} · VJ {order.vj}</span>
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
              {darfBedienen(t) && t.status === 'erfasst' && (
                <>
                  <button className="btn btn--success btn--sm" onClick={() => releaseTime(order.id, t.id)}>Freigeben</button>
                  <button className="icon-btn" onClick={() => deleteTime(order.id, t.id)}
                    aria-label="Fehlbuchung löschen" title="Fehlbuchung löschen (nur solange nicht freigegeben)">
                    <Trash2 size={15} />
                  </button>
                </>
              )}
              {darfBedienen(t) && t.status === 'freigegeben' && (
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
