import { useEffect, useState } from 'react';
import { X, Send, Trash2 } from 'lucide-react';
import { useStore, useCurrentUser } from '@/state/store';
import { useVisibleAnforderungen } from '@/state/selectors';
import { ORDERTYPES, ORDERTYPE_GROUPS, ordertypeInfo } from '@/lib/ordertypes';
import { heute } from '@/lib/heute';
import type { AnforderungStatus } from '@/lib/types';

/**
 * Auftrags-Anforderung (Workflow-Mock, Phase 0.1): Der Mitarbeiter fordert einen fehlenden Auftrag
 * an. DATEV kennt kein `POST /orders` — das Backoffice legt ihn manuell in DATEV EO an und meldet ihn
 * in der Verwaltungs-Inbox als „angelegt" zurück. Hier: Formular + Statusliste der eigenen Anfragen.
 */
const STATUS_META: Record<AnforderungStatus, { label: string; cls: string }> = {
  angefordert: { label: 'Angefordert', cls: 'badge--pending' },
  angelegt: { label: 'Angelegt', cls: 'badge--ok' },
  abgelehnt: { label: 'Abgelehnt', cls: 'badge--notok' },
};

export function AnforderungModal({ onClose }: { onClose: () => void }) {
  const me = useCurrentUser();
  const addAnforderung = useStore((s) => s.addAnforderung);
  const removeAnforderung = useStore((s) => s.removeAnforderung);
  const meine = useVisibleAnforderungen().filter((a) => a.erstelltVonId === me?.id);

  const [mandant, setMandant] = useState('');
  const [mandantNr, setMandantNr] = useState('');
  const [ordertype, setOrdertype] = useState(ORDERTYPES[0]?.ordertype ?? '');
  const [vj, setVj] = useState(Number(heute().slice(0, 4)));
  const [zeitraum, setZeitraum] = useState('');
  const [notiz, setNotiz] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const gruppen = ORDERTYPE_GROUPS.filter((g) => !g.internal);
  const kannSenden = !!me && mandant.trim() !== '' && ordertype !== '' && notiz.trim() !== '';

  function senden() {
    if (!me || !kannSenden) return;
    const art = ordertypeInfo(ordertype)?.name ?? ordertype;
    addAnforderung({ mandant: mandant.trim(), mandantNr: mandantNr.trim(), ordertype, art, vj, zeitraum: zeitraum.trim() || undefined, notiz: notiz.trim() }, me);
    setMandant(''); setMandantNr(''); setZeitraum(''); setNotiz('');
  }

  return (
    <div className="overlay" style={{ zIndex: 70 }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <button className="modal__close" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
          <div className="modal__title"><h2>Auftrag anfordern</h2></div>
          <div className="modal__sub">
            Fehlt ein Auftrag? Hier anfordern — das Backoffice legt ihn in DATEV EO an und meldet ihn zurück.
          </div>
        </div>

        <div className="modal__body">
          <div className="grid-2">
            <div className="field">
              <label>Mandant</label>
              <input className="input" value={mandant} onChange={(e) => setMandant(e.target.value)} placeholder="Mandantenname" />
            </div>
            <div className="field">
              <label>Mandanten-Nr.</label>
              <input className="input" value={mandantNr} onChange={(e) => setMandantNr(e.target.value)} placeholder="optional" />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label>Auftragsart</label>
              <select className="input" value={ordertype} onChange={(e) => setOrdertype(e.target.value)}>
                {gruppen.map((g) => (
                  <optgroup key={g.id} label={`${g.id} · ${g.name}`}>
                    {ORDERTYPES.filter((o) => o.groupId === g.id).map((o) => (
                      <option key={o.ordertype} value={o.ordertype}>{o.ordertype} — {o.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Veranlagungsjahr</label>
              <input className="input" type="number" value={vj} onChange={(e) => setVj(Number(e.target.value))} />
            </div>
          </div>

          <div className="field">
            <label>Zeitraum (optional)</label>
            <input className="input" value={zeitraum} onChange={(e) => setZeitraum(e.target.value)} placeholder="z. B. Monat/Quartal" />
          </div>

          <div className="field">
            <label>Notiz / Begründung</label>
            <textarea className="input" rows={3} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Worum geht es? Kontext fürs Backoffice." />
          </div>

          <div className="add-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn--deep" disabled={!kannSenden} onClick={senden}>
              <Send size={15} /> Anforderung senden
            </button>
          </div>

          <div className="panel__title" style={{ marginTop: 18 }}><h4>Meine Anforderungen</h4>
            <span className="count-pill" style={{ color: 'var(--bk-deep-blue)', background: 'var(--bk-blue-soft)' }}>{meine.length}</span>
          </div>
          {meine.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>Noch keine Anforderungen gestellt.</div>
          ) : (
            <div className="ctrl-rows">
              {meine.map((a) => {
                const m = STATUS_META[a.status];
                return (
                  <div className="ctrl-row" key={a.id}>
                    <span className="ctrl-row__mandant">{a.mandant}</span>
                    <span className="muted ctrl-row__meta">{a.ordertype} · {a.art} · VJ {a.vj}{a.zeitraum ? ` · ${a.zeitraum}` : ''}</span>
                    <span className="ctrl-row__right">
                      <span className={`badge ${m.cls}`}>{m.label}</span>
                      {a.status === 'abgelehnt' && a.grund && <span className="muted" style={{ fontSize: 12 }} title={a.grund}>Grund: {a.grund}</span>}
                      {a.status === 'angefordert' && (
                        <button className="btn btn--ghost btn--sm" onClick={() => removeAnforderung(a.id)} title="Anforderung zurückziehen">
                          <Trash2 size={13} /> Zurückziehen
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
