import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Order, TimeEntry } from '@/lib/types';
import { useStore, timerSeconds, useCurrentUser } from '@/state/store';
import { istEigeneZeit } from '@/state/selectors';
import { formatTimer, formatHours, artNeedsNotiz, TIME_STATUS } from '@/lib/art';
import { rolePolicy } from '@/lib/tokens';
import { heute } from '@/lib/heute';

export function TimePanel({ order }: { order: Order }) {
  const role = useStore((s) => s.role);
  const me = useCurrentUser();
  // Freigeben/Zurückziehen/Löschen nur an EIGENEN Einträgen (der Server erzwingt das ebenso) —
  // ein Partner sieht auf seinen Mandaten auch fremde Zeiten, bedient sie aber nicht.
  const darfBedienen = (t: TimeEntry) =>
    rolePolicy.canReleaseOwnTime(role) && !!me && istEigeneZeit(t, order, me);
  const start = useStore((s) => s.startTimer);
  const pause = useStore((s) => s.pauseTimer);
  const reset = useStore((s) => s.resetTimer);
  const transfer = useStore((s) => s.transferTimer);
  const addManual = useStore((s) => s.addManualTime);
  const releaseTime = useStore((s) => s.releaseTime);
  const withdrawTime = useStore((s) => s.withdrawTime);
  const deleteTime = useStore((s) => s.deleteTime);

  const [manualDauer, setManualDauer] = useState('');
  const [notiz, setNotiz] = useState('');

  const notizPflicht = artNeedsNotiz(order.artKey);
  const notizOk = !notizPflicht || notiz.trim().length > 0;

  // Der Timer-Stand kommt aus dem Start-Zeitstempel (timerSeconds) — das Intervall hier dient
  // nur der Anzeige-Aktualisierung; die Zeit läuft auch bei geschlossenem Panel korrekt weiter.
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!order.timerRunning) return;
    const iv = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [order.timerRunning]);

  const sec = timerSeconds(order);
  const laufStunden = Math.round((sec / 3600) * 100) / 100;

  function submitManual() {
    const v = parseFloat(manualDauer.replace(',', '.'));
    if (!isNaN(v) && v > 0 && notizOk) {
      // Arbeitsdatum = heute() — Demo: Stichtag HEUTE, Server-Modus: echtes Tagesdatum.
      addManual(order.id, heute(), v, notiz);
      setManualDauer('');
      setNotiz('');
    }
  }

  function submitTransfer() {
    if (laufStunden > 0 && notizOk) {
      transfer(order.id, notiz);
      setNotiz('');
    }
  }

  return (
    <div>
      <div className="subhead">Zeit erfassen</div>
      <div className="timer-box">
        <div className="timer-time tabular">{formatTimer(sec)}</div>
        <div className="timer-actions">
          {order.timerRunning ? (
            <button className="btn btn--orange" onClick={() => pause(order.id)}>Pause</button>
          ) : (
            <button className="btn btn--blue" onClick={() => start(order.id)}>Start</button>
          )}
          <button className="btn btn--ghost" onClick={() => reset(order.id)}>Reset</button>
        </div>
        <button
          className="btn btn--amber"
          style={{ width: '100%', marginTop: 10 }}
          disabled={laufStunden <= 0 || !notizOk}
          onClick={submitTransfer}
        >
          {formatHours(laufStunden)} in Karte übertragen
        </button>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Notiz{notizPflicht ? ' (Pflicht)' : ' (optional)'}</label>
        <textarea
          className="input"
          rows={2}
          placeholder={notizPflicht ? 'Worauf bezieht sich die Leistung? …' : 'Notiz zur Buchung …'}
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
        />
        {notizPflicht && !notizOk && (manualDauer.trim() !== '' || laufStunden > 0) && (
          <div className="hint" style={{ color: 'var(--bk-blood-orange)' }}>
            Bei dieser Auftragsart ist eine Notiz erforderlich.
          </div>
        )}
      </div>

      <div className="add-row">
        <input
          className="input"
          placeholder="Stunden manuell (z. B. 1,5)"
          value={manualDauer}
          onChange={(e) => setManualDauer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }}
        />
        <button className="btn btn--deep btn--sm" disabled={!notizOk} onClick={submitManual}>Hinzufügen</button>
      </div>

      <div className="times-list">
        <div className="section-label" style={{ marginBottom: 6 }}>Erfasste Zeiten</div>
        {order.times.length === 0 && <div className="muted">Noch keine Zeiten erfasst.</div>}
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
            {t.notiz && <div className="time-row__notiz">{t.notiz}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
