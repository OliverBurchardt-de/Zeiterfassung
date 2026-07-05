import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Order } from '@/lib/types';
import { ART } from '@/lib/art';
import { offeneChecklist } from '@/state/selectors';
import { ChecklistBody } from '@/features/checklist/ChecklistBody';
import { BesonderheitenBody } from '@/features/besonderheiten/BesonderheitenBody';

export type FlyoutKind = 'checkliste' | 'besonderheiten';

const WIDTH = 320;
const GAP = 10;
const MARGIN = 8;

/**
 * Klappt Checkliste/Besonderheiten als eigenständiges Panel neben das Auftrags-Detail aus.
 * Positioniert sich am `boundsEl` (dem gesamten Detail-Fenster) — rechts daneben, bei Platzmangel
 * links — statt am auslösenden Knopf: so liegt das Panel NIE über den Eingabefeldern des Details
 * und blockiert sie nicht. Vertikal orientiert es sich am Knopf (anchorEl). Folgt beim Scrollen/
 * Resize nach, schließt bei Esc oder Klick außerhalb von Panel UND Detail.
 */
export function CardFlyout({
  anchorEl, boundsEl, kind, order, onClose,
}: {
  anchorEl: HTMLElement | null;
  /** Element, dessen Fläche das Panel nicht überdecken soll (z. B. das Detail-Fenster). */
  boundsEl?: HTMLElement | null;
  kind: FlyoutKind;
  order: Order;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const art = ART[order.artKey];

  // Horizontal: am boundsEl (Detail-Fenster) vorbei — rechts daneben, sonst links.
  // Vertikal: auf Höhe des auslösenden Knopfs, aber innerhalb des boundsEl begrenzt.
  useLayoutEffect(() => {
    const bounds = boundsEl ?? anchorEl;
    if (!bounds) return;
    function place() {
      if (!bounds) return;
      const b = bounds.getBoundingClientRect();
      let left = b.right + GAP;
      if (left + WIDTH > window.innerWidth - MARGIN) left = b.left - WIDTH - GAP;
      if (left < MARGIN) left = MARGIN;
      const h = ref.current?.offsetHeight ?? 0;
      const anchorTop = anchorEl?.getBoundingClientRect().top ?? b.top;
      let top = Math.min(Math.max(anchorTop, b.top), Math.max(b.top, b.bottom - h));
      if (h && top + h > window.innerHeight - MARGIN) top = Math.max(MARGIN, window.innerHeight - MARGIN - h);
      setPos({ left, top });
    }
    place();
    const raf = requestAnimationFrame(place); // zweite Messung, sobald der Inhalt gelayoutet ist
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    // Position nachführen, wenn der Inhalt wächst (z. B. weitere Checklistenpunkte)
    const ro = new ResizeObserver(place);
    if (ref.current) ro.observe(ref.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      ro.disconnect();
    };
  }, [anchorEl, boundsEl, kind]);

  // Fokus beim Öffnen ins Panel, beim Schließen zurück auf die Karte
  useEffect(() => {
    ref.current?.focus();
    return () => { anchorEl?.focus?.(); };
  }, [anchorEl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      // Klick im Detail-Fenster (inkl. Trigger-Button) schließt das Panel NICHT — man soll im
      // Detail weiterarbeiten können, während das Panel offen daneben steht.
      if (boundsEl?.contains(t)) return;
      if (anchorEl?.contains(t)) return;
      onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [anchorEl, boundsEl, onClose]);

  const offen = offeneChecklist(order);
  const gesamt = order.checklist.length;

  return createPortal(
    <div
      ref={ref}
      className="flyout"
      role="dialog"
      aria-label={kind === 'checkliste' ? 'Checkliste' : 'Besonderheiten'}
      tabIndex={-1}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: WIDTH, visibility: pos ? 'visible' : 'hidden' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flyout__head">
        <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
        <span className="flyout__title">{kind === 'checkliste' ? 'Checkliste' : 'Besonderheiten'}</span>
        {kind === 'checkliste' && gesamt > 0 && <span className="muted">{gesamt - offen}/{gesamt}</span>}
        <button className="icon-btn" onClick={onClose} aria-label="Schließen"><X size={16} /></button>
      </div>
      <div className="flyout__sub">{order.mandant} · {order.art}</div>
      <div className="flyout__body">
        {kind === 'checkliste'
          ? <ChecklistBody order={order} />
          : <BesonderheitenBody mandantNr={order.mandantNr} ordertype={order.ordertype} />}
      </div>
    </div>,
    document.body,
  );
}
