import { useEffect, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useStore } from '@/state/store';
import { formatTimer, formatHours } from '@/lib/art';

export function TimePanel({ order }: { order: Order }) {
  const role = useStore((s) => s.role);
  const start = useStore((s) => s.startTimer);
  const pause = useStore((s) => s.pauseTimer);
  const reset = useStore((s) => s.resetTimer);
  const tick = useStore((s) => s.tick);
  const transfer = useStore((s) => s.transferTimer);
  const addManual = useStore((s) => s.addManualTime);
  const approveTime = useStore((s) => s.approveTime);
  const toggleCheck = useStore((s) => s.toggleCheck);
  const addCheck = useStore((s) => s.addCheck);
  const removeCheck = useStore((s) => s.removeCheck);

  const [manualDauer, setManualDauer] = useState('');
  const [checkDraft, setCheckDraft] = useState('');

  // Timer-Tick (1 s) nur wenn laufend
  useEffect(() => {
    if (!order.timerRunning) return;
    const iv = setInterval(() => tick(order.id), 1000);
    return () => clearInterval(iv);
  }, [order.timerRunning, order.id, tick]);

  const sec = order.timerSec ?? 0;
  const laufStunden = Math.round((sec / 3600) * 100) / 100;

  function submitManual() {
    const v = parseFloat(manualDauer.replace(',', '.'));
    if (!isNaN(v) && v > 0) {
      addManual(order.id, new Date().toISOString().slice(0, 10), v);
      setManualDauer('');
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
          disabled={laufStunden <= 0}
          onClick={() => transfer(order.id)}
        >
          {formatHours(laufStunden)} in Karte übertragen
        </button>
      </div>

      <div className="add-row">
        <input
          className="input"
          placeholder="Stunden manuell (z. B. 1,5)"
          value={manualDauer}
          onChange={(e) => setManualDauer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }}
        />
        <button className="btn btn--deep btn--sm" onClick={submitManual}>Hinzufügen</button>
      </div>

      <div className="times-list">
        <div className="section-label" style={{ marginBottom: 6 }}>Erfasste Zeiten</div>
        {order.times.length === 0 && <div className="muted">Noch keine Zeiten erfasst.</div>}
        {order.times.map((t) => (
          <div key={t.id} className="time-row">
            <span>{new Date(t.datum).toLocaleDateString('de-DE')}</span>
            <span className="tabular">{formatHours(t.dauer)}</span>
            <span className={`badge ${t.freigegeben ? 'badge--ok' : 'badge--notok'}`}>
              {t.freigegeben ? 'Freigegeben' : 'Nicht freigegeben'}
            </span>
            {!t.freigegeben && role === 'partner' && (
              <button className="btn btn--success btn--sm" onClick={() => approveTime(order.id, t.id)}>Freigeben</button>
            )}
          </div>
        ))}
      </div>

      <div className="checklist">
        <div className="section-label" style={{ marginBottom: 6 }}>Unterlagen-Checkliste</div>
        {order.checklist.map((c) => (
          <div key={c.id} className="check-item">
            <button
              className={`checkbox${c.done ? ' is-on' : ''}`}
              onClick={() => toggleCheck(order.id, c.id)}
              aria-label="abhaken"
            >
              {c.done && <Check size={13} strokeWidth={3} />}
            </button>
            <span className={`check-item__label${c.done ? ' is-done' : ''}`}>{c.label}</span>
            <button className="icon-btn" onClick={() => removeCheck(order.id, c.id)} aria-label="löschen">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="add-row">
          <input
            className="input"
            placeholder="Position hinzufügen …"
            value={checkDraft}
            onChange={(e) => setCheckDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && checkDraft.trim()) { addCheck(order.id, checkDraft.trim()); setCheckDraft(''); } }}
          />
          <button
            className="btn btn--deep btn--sm"
            onClick={() => { if (checkDraft.trim()) { addCheck(order.id, checkDraft.trim()); setCheckDraft(''); } }}
          >
            <Plus size={14} /> Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
