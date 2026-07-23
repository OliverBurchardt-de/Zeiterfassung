import { useEffect, useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical, Trash2, Plus, Minus, Play, Square } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useStore, useCurrentUser } from '@/state/store';
import { useVisibleOrders, zeitenAmTag } from '@/state/selectors';
import { ART, formatHours, artNeedsNotiz } from '@/lib/art';
import { rolePolicy } from '@/lib/tokens';
import { verhaltenFor, istKanzleiverwaltung } from '@/lib/ordertypes';
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
const DEFAULT_TAGES_SOLL = 8; // Fallback, wenn der Nutzer (noch) kein Profil-Tagessoll hat

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
  const visible = useVisibleOrders();
  const alleOrders = useStore((s) => s.orders);
  const users = useStore((s) => s.users);
  const me = useCurrentUser();
  const addManual = useStore((s) => s.addManualTime);
  const deleteTime = useStore((s) => s.deleteTime);
  const stopwatch = useStore((s) => s.stopwatch);
  const setStopwatch = useStore((s) => s.setStopwatch);
  const setStopwatchNotiz = useStore((s) => s.setStopwatchNotiz);

  const [datum, setDatum] = useState(() => heute());
  const [suche, setSuche] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // Backoffice/Admin dürfen Zeiten FÜR andere Mitarbeiter erfassen — Auswahl des Zielmitarbeiters.
  const darfFuerAndere = me ? rolePolicy.canBookForOthers(me.role, me.admin) : false;
  const [zielUserId, setZielUserId] = useState<string>(() => me?.id ?? '');
  const zielUser = users.find((u) => u.id === zielUserId) ?? me;
  const fuerAnderen = !!(zielUser && me && zielUser.id !== me.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Palette = sichtbare Aufträge PLUS die internen (Kanzleiverwaltung etc.), die firmenweit
  // bebuchbar sind (nicht im Board, aber hier erfassbar). Nach Mandant/Nr./Auftrag/Art durchsuchbar.
  const orders = useMemo(() => {
    const interne = alleOrders.filter((o) => verhaltenFor(o.ordertype) === 'intern');
    const map = new Map<string, Order>();
    for (const o of [...visible, ...interne]) map.set(o.id, o);
    return [...map.values()];
  }, [visible, alleOrders]);

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return orders.slice(0, 40);
    return orders.filter((o) => `${o.mandant} ${o.mandantNr} ${o.auftragsNr} ${o.art}`.toLowerCase().includes(q));
  }, [orders, suche]);

  // Gebuchte Blöcke des gewählten Tages FÜR den Zielmitarbeiter. Ohne startMin (z. B. nach
  // Server-Reload) der Reihe nach ab Tagesbeginn stapeln, damit sie trotzdem sichtbar sind.
  const buchungen = useMemo(() => {
    if (!zielUser) return [];
    const rows = zeitenAmTag(orders, zielUser, datum);
    let stapel = DAY_START;
    return rows.map((r) => {
      const start = r.time.startMin ?? stapel;
      stapel = Math.max(stapel, start) + Math.round(r.time.dauer * 60);
      return { row: r, start };
    });
  }, [orders, zielUser, datum]);

  // Bereits heute auf „Kanzleiverwaltung" (9801) gebuchte Stunden des Zielmitarbeiters — Basis des
  // Hinweises bei Überschreiten des kvLimitMin (kein hartes Limit, nur Warnung).
  const kvHeuteStd = useMemo(
    () =>
      buchungen
        .filter((b) => istKanzleiverwaltung(b.row.order.ordertype))
        .reduce((s, b) => s + b.row.time.dauer, 0),
    [buchungen],
  );

  // Tagessoll aus dem Nutzerprofil (Review P2-1): Teilzeitkraefte haben z. B. 6 h, nicht pauschal 8.
  const tagesSoll = zielUser?.tagessoll ?? DEFAULT_TAGES_SOLL;
  const summe = buchungen.reduce((s, b) => s + b.row.time.dauer, 0);
  const fuellPct = Math.min(100, Math.round((summe / tagesSoll) * 100));

  const slots: number[] = [];
  for (let m = DAY_START; m < DAY_END; m += SLOT) slots.push(m);
  const activeOrder = dragId ? orders.find((o) => o.id === dragId.replace('pal-', '')) ?? null : null;

  // ---- Stoppuhr (live „was arbeite ich gerade") --------------------------
  // Ein 1-Sekunden-Tick, damit die laufende Anzeige tickt (nur während sie läuft).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!stopwatch) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [stopwatch]);

  // Der laufende Auftrag (auch außerhalb der aktuellen Palette-Treffer sicher auffindbar).
  const laufOrder = stopwatch ? orders.find((o) => o.id === stopwatch.orderId) ?? alleOrders.find((o) => o.id === stopwatch.orderId) ?? null : null;
  const laufSek = stopwatch ? Math.max(0, Math.floor((Date.now() - stopwatch.startedAt) / 1000)) : 0;
  const laufNotizPflicht = !!laufOrder && artNeedsNotiz(laufOrder.artKey);

  /**
   * Verstrichene Stoppuhr-Zeit als normale Buchung schreiben (für heute) und die Uhr beenden.
   * Gibt false zurück, wenn eine Pflicht-Notiz fehlt (dann NICHT buchen, damit nichts verloren geht).
   */
  function stoppenUndBuchen(): boolean {
    if (!stopwatch || !laufOrder) { setStopwatch(null); return true; }
    if (laufNotizPflicht && !stopwatch.notiz.trim()) return false;
    const dauer = Math.round((laufSek / 3600) * 100) / 100;
    if (dauer >= 0.01) {
      // Block dort platzieren, wo tatsächlich gearbeitet wurde: jetzt minus Dauer (nur Anzeige).
      const jetzt = new Date();
      const nowMin = jetzt.getHours() * 60 + jetzt.getMinutes();
      const startMin = Math.max(DAY_START, Math.min(DAY_END - 1, nowMin - Math.round(dauer * 60)));
      addManual(laufOrder.id, heute(), dauer, stopwatch.notiz || undefined, undefined, startMin, fuerAnderen ? zielUser!.id : undefined);
    }
    setStopwatch(null);
    return true;
  }

  /** Stoppuhr für einen Auftrag starten. Läuft schon eine, wird sie erst gebucht (nacheinander). */
  function starteFuer(order: Order) {
    if (stopwatch) {
      if (stopwatch.orderId === order.id) return; // läuft bereits für diesen Auftrag
      if (!stoppenUndBuchen()) return; // Wechsel blockiert: laufende braucht noch eine Pflicht-Notiz
    }
    setStopwatch({ orderId: order.id, startedAt: Date.now(), notiz: '' });
    if (datum !== heute()) setDatum(heute()); // die Stoppuhr läuft „jetzt" → heutiger Tag
  }

  const laufHHMMSS = `${pad(Math.floor(laufSek / 3600))}:${pad(Math.floor((laufSek % 3600) / 60))}:${pad(laufSek % 60)}`;
  // Hinweis Kanzleiverwaltung-Tageslimit auch für die laufende Stoppuhr.
  const laufKvWarnung = (() => {
    if (!stopwatch || !laufOrder || !istKanzleiverwaltung(laufOrder.ordertype)) return null;
    const limit = zielUser?.kvLimitMin;
    if (limit == null) return null;
    const gesamtMin = Math.round((kvHeuteStd + laufSek / 3600) * 60);
    return gesamtMin > limit ? { gesamtMin, limit } : null;
  })();

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
    // Bucht das Backoffice für einen anderen, den Zielnutzer mitgeben (Server erzwingt die Rolle).
    addManual(draft.order.id, datum, draft.dauer, draft.notiz || undefined, undefined, draft.startMin, fuerAnderen ? zielUser!.id : undefined);
    setDraft(null);
  }

  // Hinweis (kein hartes Limit): Kanzleiverwaltung über dem Tageslimit des Zielmitarbeiters?
  const kvWarnung = (() => {
    if (!draft || !istKanzleiverwaltung(draft.order.ordertype)) return null;
    const limit = zielUser?.kvLimitMin;
    if (limit == null) return null;
    const gesamtMin = Math.round((kvHeuteStd + draft.dauer) * 60);
    return gesamtMin > limit ? { gesamtMin, limit } : null;
  })();

  return (
    <div className="ze">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Zeiterfassung</div>
      <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Zeiterfassungs-Board</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Tag wählen, Auftrag suchen und auf die Uhrzeit ziehen. Lücken siehst du direkt in der Timeline.
        <br />
        <span style={{ fontSize: 12 }}>
          Hinweis: Die Uhrzeit-Position ist eine Erfassungshilfe für den Überblick — gespeichert
          werden Datum und Dauer (DATEV kennt keine Start-Uhrzeit).
        </span>
      </p>

      {stopwatch && laufOrder && (
        <div className="ze__stopwatch" role="status">
          <span className="ze__sw-pulse" aria-hidden />
          <div className="ze__sw-info">
            <div className="ze__sw-label">Stoppuhr läuft</div>
            <div className="ze__sw-order">
              <span className="art-badge" style={{ background: ART[laufOrder.artKey].color }}>{ART[laufOrder.artKey].label}</span>
              {laufOrder.mandant} · {laufOrder.art}
            </div>
          </div>
          <div className="ze__sw-clock">{laufHHMMSS}</div>
          <input
            className="input ze__sw-notiz"
            placeholder={laufNotizPflicht ? 'Notiz (Pflicht zum Buchen) …' : 'Notiz (optional) …'}
            value={stopwatch.notiz}
            onChange={(e) => setStopwatchNotiz(e.target.value)}
          />
          <button className="btn btn--deep btn--sm" onClick={stoppenUndBuchen} disabled={laufNotizPflicht && !stopwatch.notiz.trim()} title={laufNotizPflicht && !stopwatch.notiz.trim() ? 'Erst eine Notiz eintragen' : 'Zeit stoppen und buchen'}>
            <Square size={14} /> Stopp &amp; buchen
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setStopwatch(null)} title="Ohne Buchung verwerfen">Verwerfen</button>
        </div>
      )}
      {laufKvWarnung && (
        <div className="ze__kv-warn" role="alert" style={{ marginBottom: 14 }}>
          Mehr als {laufKvWarnung.limit} Min./Tag auf Kanzleiverwaltung ({laufKvWarnung.gesamtMin} Min.) —
          das braucht eine besondere Begründung und Genehmigung. Buchen ist möglich, bitte im Zweifel abstimmen.
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onDragEnd}>
        <div className="ze__grid">
          {/* LINKS: Tagesauswahl */}
          <aside className="panel ze__days">
            {/* Backoffice/Admin: Zeiten FÜR einen Mitarbeiter erfassen (Nacherfassung). */}
            {darfFuerAndere && (
              <div className="field" style={{ marginBottom: 14 }}>
                <label className="section-label">Zeiten erfassen für</label>
                <select
                  className="input"
                  value={zielUserId}
                  onChange={(e) => { setZielUserId(e.target.value); setDraft(null); }}
                >
                  {me && <option value={me.id}>Mich selbst ({me.name})</option>}
                  {users.filter((u) => u.aktiv && u.id !== me?.id).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {fuerAnderen && (
                  <div className="hint">Buchungen gehen auf das Konto von {zielUser?.name}.</div>
                )}
              </div>
            )}
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
              <div className="muted" style={{ fontSize: 12 }}>von {formatHours(tagesSoll)} · {fuellPct}%</div>
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
                  style={{ top: (draft.startMin - DAY_START) * PX_PER_MIN, height: Math.max(kvWarnung ? 118 : 64, draft.dauer * HOUR_PX - 2), borderLeftColor: ART[draft.order.artKey].color }}
                >
                  <div className="ze__block-head">
                    <span className="ze__block-time">{label(draft.startMin)}–{label(draft.startMin + Math.round(draft.dauer * 60))}</span>
                    <div className="ze__step">
                      <button className="icon-btn" aria-label="kürzer" onClick={() => setDraft({ ...draft, dauer: Math.max(0.25, Math.round((draft.dauer - 0.25) * 100) / 100) })}><Minus size={13} /></button>
                      <span className="ze__block-dur">{formatHours(draft.dauer)}</span>
                      {/* Nicht ueber das Timeline-Ende (20:00) hinaus verlaengern (Review P2-1). */}
                      <button className="icon-btn" aria-label="länger" onClick={() => setDraft({ ...draft, dauer: Math.min((DAY_END - draft.startMin) / 60, Math.round((draft.dauer + 0.25) * 100) / 100) })}><Plus size={13} /></button>
                    </div>
                  </div>
                  <div className="ze__block-mandant">{draft.order.mandant} · {draft.order.art}</div>
                  <input
                    className="input ze__block-notiz"
                    placeholder={artNeedsNotiz(draft.order.artKey) ? 'Notiz (Pflicht) …' : 'Notiz (optional) …'}
                    value={draft.notiz}
                    onChange={(e) => setDraft({ ...draft, notiz: e.target.value })}
                  />
                  {kvWarnung && (
                    <div className="ze__kv-warn" role="alert">
                      Mehr als {kvWarnung.limit} Min./Tag auf Kanzleiverwaltung ({kvWarnung.gesamtMin} Min.) —
                      das braucht eine besondere Begründung und Genehmigung. Buchen ist möglich, bitte im Zweifel abstimmen.
                    </div>
                  )}
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
              {treffer.map((o) => (
                <PaletteOrder
                  key={o.id}
                  order={o}
                  running={stopwatch?.orderId === o.id}
                  onStart={() => starteFuer(o)}
                  onStop={stoppenUndBuchen}
                />
              ))}
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

/** Ziehbarer Auftrag in der Palette — mit Start/Stopp-Knopf für die Stoppuhr. */
function PaletteOrder({ order, running, onStart, onStop }: { order: Order; running: boolean; onStart: () => void; onStop: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `pal-${order.id}` });
  return (
    <div ref={setNodeRef} className={`ze__pal-card${isDragging ? ' is-ghost' : ''}${running ? ' is-running' : ''}`} {...attributes} {...listeners}>
      <GripVertical size={14} className="muted" />
      <span className="art-badge" style={{ background: ART[order.artKey].color }}>{ART[order.artKey].label}</span>
      <div className="ze__pal-body">
        <div className="ze__pal-mandant">{order.mandant}</div>
        <div className="muted" style={{ fontSize: 12 }}>{order.mandantNr} · {order.art}</div>
      </div>
      {/* Stoppuhr starten/stoppen — onPointerDown stoppt das Drag-Listener, damit der Klick nicht zieht. */}
      <button
        className={`ze__pal-timer${running ? ' is-running' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={running ? onStop : onStart}
        aria-label={running ? 'Stoppuhr stoppen und buchen' : 'Stoppuhr für diesen Auftrag starten'}
        title={running ? 'Stoppen & buchen' : 'Stoppuhr starten'}
      >
        {running ? <Square size={15} /> : <Play size={15} />}
      </button>
    </div>
  );
}
