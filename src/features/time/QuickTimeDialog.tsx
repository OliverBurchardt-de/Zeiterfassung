import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useStore } from '@/state/store';
import { heute } from '@/lib/heute';

/**
 * Schnellbuchung laufender Zeiten direkt aus dem Auftrag heraus — ohne Screenwechsel.
 * Dank der 1:1-Beziehung Mandant ↔ laufender Auftrag wird das Ziel automatisch aufgelöst
 * (gleiche Mandantennr + Auftragsart Beratung bzw. Mehraufwand). Pflicht-Notiz; bei
 * Mehraufwand zusätzlich die Aufwandsart (Mehraufwand / Dumm gelaufen).
 */
type Kategorie = 'beratung' | 'mehraufwand' | 'dumm';

export function QuickTimeDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const orders = useStore((s) => s.orders);
  const addManual = useStore((s) => s.addManualTime);

  const beratung = orders.find((o) => o.mandantNr === order.mandantNr && o.artKey === 'lfd_beratung');
  const mehr = orders.find((o) => o.mandantNr === order.mandantNr && o.artKey === 'mehraufwand');

  const optionen: { key: Kategorie; label: string }[] = [];
  if (beratung) optionen.push({ key: 'beratung', label: 'Laufende Steuerberatung' });
  if (mehr) optionen.push({ key: 'mehraufwand', label: 'Mehraufwand' }, { key: 'dumm', label: 'Dumm gelaufen' });

  const [kat, setKat] = useState<Kategorie | ''>(optionen[0]?.key ?? '');
  const [dauer, setDauer] = useState('');
  const [notiz, setNotiz] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const v = parseFloat(dauer.replace(',', '.'));
  const ok = kat !== '' && !isNaN(v) && v > 0 && notiz.trim().length > 0;

  function submit() {
    if (!ok) return;
    const ziel = kat === 'beratung' ? beratung : mehr;
    if (!ziel) return;
    const aufwandsart = kat === 'mehraufwand' ? 'mehraufwand' : kat === 'dumm' ? 'dumm' : undefined;
    // Arbeitsdatum = heute() — Demo: Stichtag HEUTE, Server-Modus: echtes Tagesdatum.
    addManual(ziel.id, heute(), v, notiz, aufwandsart);
    setDone(true);
  }

  return (
    <div className="overlay" style={{ zIndex: 70 }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <button className="modal__close" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
          <div className="modal__title"><h2>Laufende Zeit buchen</h2></div>
          <div className="modal__sub">{order.mandant} · wird auf den laufenden Auftrag des Mandanten gebucht</div>
        </div>

        <div className="modal__body">
          {optionen.length === 0 ? (
            <div className="muted">
              Für diesen Mandanten ist kein laufender Auftrag (Steuerberatung / Mehraufwand)
              vorhanden. Diese entstehen in DATEV (Mehraufwand nur bei FiBu und/oder Lohn).
            </div>
          ) : done ? (
            <div className="hint" style={{ color: 'var(--bk-success)', fontSize: 14 }}>
              Zeit gebucht. Sie erscheint unter „Laufende Buchungen" und wartet auf Freigabe.
              <div className="add-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost btn--sm" onClick={() => { setDone(false); setDauer(''); setNotiz(''); }}>Weitere buchen</button>
                <button className="btn btn--deep btn--sm" onClick={onClose}>Schließen</button>
              </div>
            </div>
          ) : (
            <>
              <div className="field">
                <label>Kategorie</label>
                <select className="input" value={kat} onChange={(e) => setKat(e.target.value as Kategorie)}>
                  {optionen.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Stunden</label>
                <input className="input" placeholder="z. B. 0,75" value={dauer} onChange={(e) => setDauer(e.target.value)} />
              </div>
              <div className="field">
                <label>Notiz (Pflicht)</label>
                <textarea className="input" rows={2} placeholder="Worauf bezieht sich die Leistung? …" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
                {notiz.trim() === '' && dauer.trim() !== '' && (
                  <div className="hint" style={{ color: 'var(--bk-blood-orange)' }}>Eine Notiz ist erforderlich.</div>
                )}
              </div>
              <div className="add-row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost btn--sm" onClick={onClose}>Abbrechen</button>
                <button className="btn btn--deep btn--sm" disabled={!ok} onClick={submit}>Zeit buchen</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
