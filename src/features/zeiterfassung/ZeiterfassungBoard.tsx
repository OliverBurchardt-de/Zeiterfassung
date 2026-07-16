import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical, Trash2, Plus, Minus } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useStore, useCurrentUser } from '@/state/store';
import { useVisibleOrders, zeitenAmTag } from '@/state/selectors';
import { ART, formatHours, artNeedsNotiz } from '@/lib/art';
import { heute } from '@/lib/heute';

/**
 * Zeiterfassungs-Board (memtime-Stil, Entscheidung 15.07.2026 —
 * docs/zeiterfassung-board-konzept.md §2): links die Tagesauswahl, in der Mitte die grafische
 * Tages-Timeline (Lücken sichtbar → „Tag voll?"), rechts die Auftrags-Palette. Der Mitarbeiter
 * sucht seinen Auftrag (Mandantennummer/Name) und zieht ihn per Drag & Drop auf eine Uhrzeit;
 * danach Dauer/Notiz setzen → buchen. Gebucht wird über dieselbe Kette wie sonst (addManualTime).
 *
 * Die Uhrzeit (startMin) ist reine Anzeige — DATEV speichert nur Datum+Dauer; nach einem Reload
 * im Server-Modus stapelt die Timeline Blöcke ohne startMin der Reihe nach.
 */

const DAY_START = 7 * 60; // 07:00
const DAY_END = 20 * 60; // 20:00
const SLOT = 30; // Minuten je Raster-Zeile
const HOUR_PX = 60;
const PX_PER_MIN = HOUR_PX / 60;
const TAGES_SOLL = 8; // Stunden — Basis für „Tag voll?"

const pad = (n: number) => String(n).padStart(2, '0');
const label = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** Datum n Tage vor heute als ISO "JJJJ-MM-TT" (n=0 heute). Nutzt heute() als Anker. */
function tagVor(n: number): string {
  const [y, m, d] = heute().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - n));
  return dt.toISOString().slice(0, 10);
}
function datumLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  });
}

interface Draft { order: Order; startMin: number; dauer: number; notiz: string }

export function ZeiterfassungBoard() {
  const orders = useVisibleOrders();
  const me = useCurrentUser();
  const addManual = useStore((s) => s.addManualTime);
  const deleteTime = useStore((s) => s.deleteTime);

  const [datum, setDatum] = useState(() => heute());
  const [suche, setSuche] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Palette: alle sichtbaren Aufträge, nach Mandant/Mandantennr./AuftragsNr/Art durchsuchbar.
  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return orders.slice(0, 40);
    return orders.filter((o) => `${o.mandant} ${o.mandantNr} ${o.auftragsNr} ${o.art}`.toLowerCase().includes(q));
  }, [orders, suche]);

  // Gebuchte Blöcke des gewählten Tages. Ohne startMin (z. B. nach Server-Reload) der Reihe
  // nach ab Tagesbeginn stapeln, damit sie trotzdem sichtbar sind.
  const buchungen = useMemo(() => {
    if (!me) return [];
    const rows = zeitenAmTag(orders, me, datum);
    let stapel = DAY_START;
    return rows.map((r) => {
      const start = r.time.startMin ?? stapel;
      stapel = Math.max(stapel, start) + Math.round(r.time.dauer * 60);
      return { row: r, start };
    });
  }, [orders, me, datum]);

  const summe = buchungen.reduce((s, b) => s + b.row.time.dauer, 0);
  const fuellPct = Math.min(100, Math.round((summe / TAGES_SOLL) * 100));

  const slots: number[] = [];
  for (let m = DAY_START; m < DAY_END; m += SLOT) slots.push(m);
  const activeOrder = dragId ? orders.find((o) => o.id === dragId.replace('pal-', '')) ?? null : null;

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const over = e.over?.id;
    const order = orders.find((o) => o.id === String(e.active.id).replace('pal-', ''));
    if (!order || typeof over !== 'string' || !over.startsWith('slot-')) return;
    setDraft({ order, startMin: Number(over.slice(5)), dauer: 0.5, notiz: '' });
  }

  function buchen() {
    if (!draft) return;
    const pflicht = artNeedsNotiz(draft.order.artKey);
    if (draft.dauer <= 0 || (pflicht && !draft.notiz.trim())) return;
    addManual(draft.order.id, datum, draft.dauer, draft.notiz || undefined, undefined, draft.startMin);
    setDraft(null);
  }

  return (
    <div className="ze">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Zeiterfassung</div>
      <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Zeiterfassungs-Board</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Tag wählen, Auftrag suchen und auf die Uhrzeit ziehen. Lücken siehst du direkt in der Timeline.
      </p>

      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onDragEnd}>
        <div className="ze__grid">
          {/* LINKS: Tagesauswahl */}
          <aside className="panel ze__days">
            <h4 style={{ marginBottom: 10 }}>Tag</h4>
            {[0, 1, 2].map((n) => {
              const iso = tagVor(n);
              const lab = n === 0 ? 'Heute' : n === 1 ? 'Gestern' : 'Vorgestern';
              return (
                <button key={n} className={`ze__day${datum === iso ? ' is-active' : ''}`} onClick={() => { setDatum(iso); setDraft(null); }}>
                  <span>{lab}</span>
                  <span className="muted">{iso.split('-').reverse().slice(0, 2).join('.')}</span>
                </button>
              );
            })}
            <label className="section-label" style={{ marginTop: 12 }}>Anderer Tag</label>
            <input type="date" className="input" value={datum} onChange={(e) => { if (e.target.value) { setDatum(e.target.value); setDraft(null); } }} />

            <div className="ze__sum" style={{ marginTop: 18 }}>
              <div className="ze__sum-num">{formatHours(summe)}</div>
              <div className="muted" style={{ fontSize: 12 }}>von {TAGES_SOLL} h · {fuellPct}%</div>
              <div className="ze__bar"><div className="ze__bar-fill" style={{ width: `${fuellPct}%` }} /></div>
            </div>
          </aside>

          {/* MITTE: Tages-Timeline */}
          <section className="panel ze__timeline-wrap">
            <div className="ze__day-title">{datumLabel(datum)}</div>
            <div className="ze__timeline" style={{ height: (DAY_END - DAY_START) * PX_PER_MIN }}>
              {slots.map((m) => <TimeSlot key={m} startMin={m} showLabel={m % 60 === 0} />)}

              {buchungen.map((b) => (
                <div
                  key={b.row.time.id}
                  className="ze__block"
                  style={{
                    top: (b.start - DAY_START) * PX_PER_MIN,
                    height: Math.max(18, b.row.time.dauer * HOUR_PX - 2),
                    borderLeftColor: ART[b.row.order.artKey].color,
                  }}
                >
                  <div className="ze__block-head">
                    <span className="ze__block-time">{label(b.start)}–{label(b.start + Math.round(b.row.time.dauer * 60))}</span>
                    <span className="ze__block-dur">{formatHours(b.row.time.dauer)}</span>
                    {b.row.time.status === 'erfasst' && (
                      <button className="icon-btn" aria-label="Buchung löschen" onClick={() => deleteTime(b.row.order.id, b.row.time.id)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="ze__block-mandant">{b.row.order.mandant}</div>
                  <div className="ze__block-art muted">{b.row.order.art}{b.row.time.notiz ? ` · ${b.row.time.notiz}` : ''}</div>
                </div>
              ))}

              {/* Entwurf (gerade gezogen, noch nicht gebucht) */}
              {draft && (
                <div
                  className="ze__block ze__block--draft"
                  style={{ top: (draft.startMin - DAY_START) * PX_PER_MIN, height: Math.max(64, draft.dauer * HOUR_PX - 2), borderLeftColor: ART[draft.order.artKey].color }}
                >
                  <div className="ze__block-head">
                    <span className="ze__block-time">{label(draft.startMin)}–{label(draft.startMin + Math.round(draft.dauer * 60))}</span>
                    <div className="ze__step">
                      <button className="icon-btn" aria-label="kürzer" onClick={() => setDraft({ ...draft, dauer: Math.max(0.25, Math.round((draft.dauer - 0.25) * 100) / 100) })}><Minus size={13} /></button>
                      <span className="ze__block-dur">{formatHours(draft.dauer)}</span>
                      <button className="icon-btn" aria-label="länger" onClick={() => setDraft({ ...draft, dauer: Math.round((draft.dauer + 0.25) * 100) / 100 })}><Plus size={13} /></button>
                    </div>
                  </div>
                  <div className="ze__block-mandant">{draft.order.mandant} · {draft.order.art}</div>
                  <input
                    className="input ze__block-notiz"
                    placeholder={artNeedsNotiz(draft.order.artKey) ? 'Notiz (Pflicht) …' : 'Notiz (optional) …'}
                    value={draft.notiz}
                    onChange={(e) => setDraft({ ...draft, notiz: e.target.value })}
                  />
                  <div className="ze__draft-actions">
                    <button className="btn btn--deep btn--sm" onClick={buchen}>Buchen</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setDraft(null)}>Abbrechen</button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* RECHTS: Auftrags-Palette */}
          <aside className="panel ze__palette">
            <h4 style={{ marginBottom: 10 }}>Aufträge</h4>
            <input className="input" placeholder="Mandantennr., Mandant oder Auftrag …" value={suche} onChange={(e) => setSuche(e.target.value)} aria-label="Aufträge suchen" />
            <p className="muted" style={{ fontSize: 12, margin: '8px 0 10px' }}>Auf eine Uhrzeit in der Timeline ziehen.</p>
            <div className="ze__pal-list">
              {treffer.map((o) => <PaletteOrder key={o.id} order={o} />)}
              {treffer.length === 0 && <p className="muted">Keine Treffer.</p>}
            </div>
          </aside>
        </div>

        <DragOverlay>
          {activeOrder && (
            <div className="ze__pal-card is-drag">
              <span className="art-badge" style={{ background: ART[activeOrder.artKey].color }}>{ART[activeOrder.artKey].label}</span>
              <span className="ze__pal-mandant">{activeOrder.mandant}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/** Eine 30-Minuten-Zeile der Timeline — Drop-Ziel; auf Stunden zeigt sie das Uhrzeit-Label. */
function TimeSlot({ startMin, showLabel }: { startMin: number; showLabel: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${startMin}` });
  return (
    <div ref={setNodeRef} className={`ze__slot${isOver ? ' is-over' : ''}`} style={{ height: SLOT * PX_PER_MIN }}>
      {showLabel && <span className="ze__slot-label">{label(startMin)}</span>}
    </div>
  );
}

/** Ziehbarer Auftrag in der Palette. */
function PaletteOrder({ order }: { order: Order }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `pal-${order.id}` });
  return (
    <div ref={setNodeRef} className={`ze__pal-card${isDragging ? ' is-ghost' : ''}`} {...attributes} {...listeners}>
      <GripVertical size={14} className="muted" />
      <span className="art-badge" style={{ background: ART[order.artKey].color }}>{ART[order.artKey].label}</span>
      <div className="ze__pal-body">
        <div className="ze__pal-mandant">{order.mandant}</div>
        <div className="muted" style={{ fontSize: 12 }}>{order.mandantNr} · {order.art}</div>
      </div>
    </div>
  );
}
