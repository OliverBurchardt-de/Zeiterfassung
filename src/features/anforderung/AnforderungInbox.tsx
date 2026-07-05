import { useState } from 'react';
import { Check, Ban, X } from 'lucide-react';
import { useStore } from '@/state/store';
import { useVisibleAnforderungen } from '@/state/selectors';
import type { AnforderungStatus } from '@/lib/types';

/**
 * Backoffice-Inbox der Auftrags-Anforderungen (Verwaltung, Admin). Offene werden als „angelegt"
 * gemeldet (nachdem das Backoffice den Auftrag in DATEV EO angelegt hat) oder mit Grund abgelehnt.
 * In M2 löst „angefordert" eine E-Mail aus; „angelegt" käme dann per DATEV-Sync. Siehe docs/m2-plan.md.
 */
const STATUS_META: Record<AnforderungStatus, { label: string; cls: string }> = {
  angefordert: { label: 'Angefordert', cls: 'badge--pending' },
  angelegt: { label: 'Angelegt', cls: 'badge--ok' },
  abgelehnt: { label: 'Abgelehnt', cls: 'badge--notok' },
};

export function AnforderungInbox() {
  const items = useVisibleAnforderungen();
  const setAngelegt = useStore((s) => s.setAnforderungAngelegt);
  const setAbgelehnt = useStore((s) => s.setAnforderungAbgelehnt);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [grund, setGrund] = useState('');

  const offen = items.filter((a) => a.status === 'angefordert');
  const erledigt = items.filter((a) => a.status !== 'angefordert');

  function ablehnen(id: string) {
    setAbgelehnt(id, grund);
    setRejectId(null);
    setGrund('');
  }

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div className="panel__title"><h4>Auftrags-Anforderungen</h4>
        <span className="count-pill" style={{ color: 'var(--bk-amber-text)', background: 'var(--bk-amber-soft)' }}>{offen.length}</span>
      </div>
      <div className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        Vom Mitarbeiter angeforderte Aufträge. Nach Anlage in DATEV EO „als angelegt melden" — der
        Auftrag erscheint beim nächsten Sync im Tool (Mock). Ablehnen mit Grund ist möglich.
      </div>

      {offen.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>Keine offenen Anforderungen.</div>
      ) : (
        <div className="ctrl-rows">
          {offen.map((a) => (
            <div className="ctrl-row" key={a.id}>
              <span className="ctrl-row__mandant">{a.mandant}{a.mandantNr ? ` · ${a.mandantNr}` : ''}</span>
              <span className="muted ctrl-row__meta">{a.ordertype} · {a.art} · VJ {a.vj}{a.zeitraum ? ` · ${a.zeitraum}` : ''} · von {a.erstelltVon}</span>
              <span className="ctrl-row__note">{a.notiz}</span>
              <span className="ctrl-row__right">
                {rejectId === a.id ? (
                  <>
                    <input className="input" style={{ minWidth: 180 }} autoFocus value={grund}
                      onChange={(e) => setGrund(e.target.value)} placeholder="Grund der Ablehnung …"
                      onKeyDown={(e) => { if (e.key === 'Enter') ablehnen(a.id); }} />
                    <button className="btn btn--ghost btn--sm" onClick={() => ablehnen(a.id)}>Ablehnen</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setRejectId(null); setGrund(''); }} aria-label="Abbrechen"><X size={13} /></button>
                  </>
                ) : (
                  <>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setRejectId(a.id); setGrund(''); }}><Ban size={13} /> Ablehnen</button>
                    <button className="btn btn--success btn--sm" onClick={() => setAngelegt(a.id)}><Check size={13} /> Als angelegt melden</button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {erledigt.length > 0 && (
        <>
          <div className="panel__title" style={{ marginTop: 18 }}><h4>Erledigt</h4></div>
          <div className="ctrl-rows">
            {erledigt.map((a) => {
              const m = STATUS_META[a.status];
              return (
                <div className="ctrl-row" key={a.id}>
                  <span className="ctrl-row__mandant">{a.mandant}</span>
                  <span className="muted ctrl-row__meta">{a.ordertype} · {a.art} · VJ {a.vj} · von {a.erstelltVon}</span>
                  <span className="ctrl-row__right">
                    <span className={`badge ${m.cls}`}>{m.label}</span>
                    {a.status === 'abgelehnt' && a.grund && <span className="muted" style={{ fontSize: 12 }}>Grund: {a.grund}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
