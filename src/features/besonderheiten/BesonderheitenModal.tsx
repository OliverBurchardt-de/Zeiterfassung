import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/state/store';
import { ART } from '@/lib/art';
import { BesonderheitenBody } from './BesonderheitenBody';

/**
 * Dialog für Mandantenbesonderheiten. Inhalte hängen am Schlüssel Mandant + Auftragsart und
 * werden dadurch automatisch von den Aufträgen der Folgeperioden (Jahr/Monat) wiederverwendet.
 */
export function BesonderheitenModal() {
  const ctx = useStore((s) => s.besOpen);
  const close = useStore((s) => s.closeBesonderheiten);

  useEffect(() => {
    if (!ctx) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ctx, close]);

  if (!ctx) return null;
  const art = ART[ctx.artKey];

  return (
    <div className="overlay" style={{ zIndex: 70 }} onClick={close}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <button className="modal__close" onClick={close} aria-label="Schließen"><X size={18} /></button>
          <div className="modal__title">
            <h2>Besonderheiten</h2>
            <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
          </div>
          <div className="modal__sub">{ctx.mandant} · {ctx.art}</div>
        </div>

        <div className="modal__body">
          <BesonderheitenBody mandantNr={ctx.mandantNr} artKey={ctx.artKey} />
        </div>
      </div>
    </div>
  );
}
