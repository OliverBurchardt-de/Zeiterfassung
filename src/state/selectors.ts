import { useMemo } from 'react';
import type { Order, Note, TimeEntry, User, AuftragsAnforderung, Task } from '@/lib/types';
import { useStore, noteOffen } from './store';
import { erfassteStunden } from '@/lib/art';
import { istPlanbar } from '@/lib/ordertypes';
import { parseMonat } from '@/lib/monate';
import { heute } from '@/lib/heute';

// ---- Sichtbarkeit / Zugriff ---------------------------------------------

/**
 * Aufträge, die ein Nutzer sehen darf („nur eigene zugewiesene"):
 * - Admin: alle. - Partner: seine verantworteten Mandate (+ eigene Bearbeitung).
 * - Mitarbeiter: nur Aufträge, bei denen er Bearbeiter ist.
 * HINWEIS: reine Frontend-Sicht (Mock-Preview). Verbindlich erst serverseitig in M2.
 */
export function sichtbareAuftraege(orders: Order[], user?: User): Order[] {
  if (!user) return [];
  if (user.admin) return orders;
  if (user.role === 'partner') return orders.filter((o) => o.partner === user.name || o.bearbeiter === user.name);
  return orders.filter((o) => o.bearbeiter === user.name);
}

/** Hook: die für den angemeldeten Nutzer sichtbaren Aufträge. */
export function useVisibleOrders(): Order[] {
  const orders = useStore((s) => s.orders);
  const user = useStore((s) => s.users.find((u) => u.id === s.currentUserId));
  return useMemo(() => sichtbareAuftraege(orders, user), [orders, user]);
}

// ---- Umplanungs-Regeln (JA/ESt) -----------------------------------------
// Reine Regeln leben in src/lib/regeln.ts (auch der Store-Guard nutzt sie);
// hier nur re-exportiert, damit bestehende Importe stabil bleiben.
export { FREIE_UMPLANUNGEN_PRO_JAHR, umplanungRegelGilt, umplanungFreiMoeglich, freieUmplanungenRest } from '@/lib/regeln';

// ---- Auftrags-Anforderungen ---------------------------------------------

/** Anforderungen, die ein Nutzer sehen darf: Admin/Backoffice alle, sonst nur eigene. */
export function sichtbareAnforderungen(items: AuftragsAnforderung[], user?: User): AuftragsAnforderung[] {
  if (!user) return [];
  if (user.admin) return items;
  return items.filter((a) => a.erstelltVonId === user.id);
}

/** Hook: für den angemeldeten Nutzer sichtbare Anforderungen (eigene bzw. alle für Admin). */
export function useVisibleAnforderungen(): AuftragsAnforderung[] {
  const items = useStore((s) => s.anforderungen);
  const user = useStore((s) => s.users.find((u) => u.id === s.currentUserId));
  return useMemo(() => sichtbareAnforderungen(items, user), [items, user]);
}

// ---- Zeiten & Freigaben -------------------------------------------------

export interface ZeitRow { order: Order; time: TimeEntry }
export interface ReviewFreigabe { order: Order; note: Note }

/** Gilt die Zeit als gültig (freigegeben oder bereits nach DATEV übertragen)? */
export function istFreigegeben(t: TimeEntry): boolean {
  return t.status !== 'erfasst';
}

/** Aufträge mit ausstehender Umplanungs-Freigabe (Partner-Cockpit). */
export function offeneUmplanungen(orders: Order[]): Order[] {
  return orders.filter((o) => o.umplanung?.freigabeAusstehend);
}

/** Review-Notes, die der Mitarbeiter als „erledigt" gemeldet hat → warten auf Partner-Freigabe. */
export function offeneReviewFreigaben(orders: Order[]): ReviewFreigabe[] {
  const out: ReviewFreigabe[] = [];
  for (const o of orders) for (const n of o.notes) if (n.kind === 'review' && n.noteState === 'erledigt') out.push({ order: o, note: n });
  return out;
}

/**
 * Gehört der Zeiteintrag dem Nutzer? Server-Modus: über die Zeit-Ownership (`t.userId`, vom
 * Server geliefert und dort erzwungen). Demo-Mock hat kein userId → Fallback: alle Einträge
 * eines Auftrags gehören dessen Bearbeiter.
 */
export function istEigeneZeit(t: TimeEntry, o: Order, user: { id: string; name: string }): boolean {
  return t.userId ? t.userId === user.id : o.bearbeiter === user.name;
}

/** Zeitbuchungen eines Nutzers (Modul „Meine Zeiten") — kind-genau über die Zeit-Ownership. */
export function zeitenVon(orders: Order[], user: { id: string; name: string }): ZeitRow[] {
  const out: ZeitRow[] = [];
  for (const o of orders) for (const t of o.times) if (istEigeneZeit(t, o, user)) out.push({ order: o, time: t });
  return out;
}

/**
 * Eigene Zeitbuchungen eines Nutzers an EINEM Tag (Zeiterfassungs-Board). Sortiert nach
 * Startminute (Blöcke ohne startMin ans Ende) — die Timeline positioniert danach.
 */
export function zeitenAmTag(orders: Order[], user: { id: string; name: string }, datum: string): ZeitRow[] {
  return zeitenVon(orders, user)
    .filter((r) => r.time.datum === datum)
    .sort((a, b) => (a.time.startMin ?? 1e9) - (b.time.startMin ?? 1e9));
}

/** Hat der Auftrag noch nicht freigegebene (erfasste) Zeiten? */
export function hasOffeneZeiten(o: Order): boolean {
  return o.times.some((t) => t.status === 'erfasst');
}

/** Anzahl noch offener Checklisten-Punkte */
export function offeneChecklist(o: Order): number {
  return o.checklist.filter((c) => !c.done).length;
}

/** Darf der Auftrag auf „Erledigt" gesetzt werden? (Checkliste vollständig) */
export function canComplete(o: Order): boolean {
  return offeneChecklist(o) === 0;
}

/** Aktiv bearbeitet, aber noch keine Zeit erfasst? (für Reminder/Filter) */
export function ohneZeit(o: Order): boolean {
  const aktiv = ['bb', 'rf', 'rn'].includes(o.status);
  return aktiv && o.times.length === 0;
}

// ---- Controlling --------------------------------------------------------

/** Auslastung (0..n) eines Auftragsbestands: erfasste Stunden / Soll-Stunden. */
export function auslastungPct(o: Order): number {
  if (o.soll <= 0) return 0;
  return erfassteStunden(o.times) / o.soll;
}

/** Überfällig: Fristende liegt vor dem Stichtag (heute) und der Auftrag ist nicht erledigt. */
export function istUeberfaellig(o: Order): boolean {
  // Ungeplante Aufträge haben leeres Fristende ('') → nicht als überfällig werten (Review-Hinweis 5.2).
  if (!o.fristEnde) return false;
  return o.fristEnde < heute() && o.status !== 'er';
}

/**
 * Noch nicht abgerechnet: Auftrag ist nicht „Fakturiert", trägt aber bereits Buchungen
 * (erfasste Zeiten/Leistungen). In Produktion liefert dies ein Hintergrund-API-Pull aus DATEV.
 */
export function istNichtAbgerechnet(o: Order): boolean {
  // Nur freigegebene Zeiten gelten als abrechenbar — erfasste Buchungen sind noch kein Rückstand.
  return !o.fakturiert && o.times.some(istFreigegeben);
}

/** Auftragsliste nach den aktuellen Filtern (ohne Status — der ergibt die Spalte) */
export function useFilteredOrders(): Order[] {
  const orders = useVisibleOrders();
  const f = useStore((s) => s.filters);

  return orders.filter((o) => {
    // Nur PLANBARE Auftragsarten gehören ins Kanban-Board (Entscheidung 15.07.2026,
    // docs/zeiterfassung-board-konzept.md §1) — laufende, sonstige und interne nicht.
    // Sonstige bleiben bebuchbar über das Buchungs-Modul (LaufendeView, Abschnitt „Sonstige").
    if (!istPlanbar(o.ordertype)) return false;
    if (f.employeeId !== 'team' && o.bearbeiterId !== f.employeeId) return false;
    if (f.monat !== 'alle' && o.monat !== f.monat) return false;
    if (f.vj !== 'alle' && o.vj !== f.vj) return false;
    if (f.arten.length > 0 && !f.arten.includes(o.artKey)) return false;
    if (f.nurOffeneZeiten && !(hasOffeneZeiten(o) || ohneZeit(o))) return false;
    if (f.freigabeAusstehend && !o.umplanung?.freigabeAusstehend) return false;
    if (f.suche.trim()) {
      const q = f.suche.trim().toLowerCase();
      const haystack = `${o.mandant} ${o.mandantNr} ${o.auftragsNr} ${o.art}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Nächster OFFENER Teilauftrag eines Auftrags (Entscheidung 15.07.2026): Auf der Karte zählt
 * nur der nächste noch nicht abgeschlossene Monat/Quartal — nicht die ganze Liste. Sortiert
 * chronologisch über den Monat (Suborder kommen aus DATEV nicht garantiert sortiert).
 */
export function naechsterOffenerTeilauftrag(o: Order) {
  const offene = (o.suborders ?? []).filter((s) => !s.erledigtAm);
  if (offene.length === 0) return undefined;
  return [...offene].sort((a, b) => {
    const pa = parseMonat(a.monat);
    const pb = parseMonat(b.monat);
    if (!pa || !pb) return 0;
    return pa.year - pb.year || pa.monthIndex - pb.monthIndex;
  })[0];
}

/** KPI-Kennzahlen für die gefilterte Sicht */
export function kpis(orders: Order[]) {
  const zugeteilt = orders.length;
  const inBearbeitung = orders.filter((o) => o.status === 'bb').length;
  const zeitenOffen = orders.filter((o) => hasOffeneZeiten(o) || ohneZeit(o)).length;
  const reviewNotes = orders.filter((o) => o.notes.some(noteOffen)).length;
  return { zugeteilt, inBearbeitung, zeitenOffen, reviewNotes };
}

/** Heute erfasste Stunden der gefilterten Aufträge — unabhängig vom Freigabestatus. */
export const TAGES_SOLL = 8.0;

export function heuteErfasst(orders: Order[]): { gesamt: number; perMandant: { mandant: string; stunden: number }[] } {
  // Pro Mandant aggregieren (mehrere Aufträge desselben Mandanten → eine Zeile) und die
  // Top 5 nach Stunden zeigen — sonst doppelte Zeilen/React-Keys und ein zufälliges „Top 5".
  const map = new Map<string, number>();
  let gesamt = 0;
  const stichtag = heute();
  for (const o of orders) {
    const h = erfassteStunden(o.times.filter((t) => t.datum === stichtag));
    if (h > 0) {
      gesamt += h;
      map.set(o.mandant, (map.get(o.mandant) ?? 0) + h);
    }
  }
  const perMandant = Array.from(map.entries())
    .map(([mandant, stunden]) => ({ mandant, stunden }))
    .sort((a, b) => b.stunden - a.stunden)
    .slice(0, 5);
  return { gesamt, perMandant };
}

// ---- Aufgaben (To-Dos) ---------------------------------------------------

/**
 * Ist eine offene Aufgabe überfällig? (Fälligkeit vor dem heutigen Stichtag — heute() respektiert
 * Demo-Stichtag bzw. echtes Datum.) Erledigte oder terminlose Aufgaben sind nie überfällig.
 */
export function taskUeberfaellig(t: Task): boolean {
  return t.status === 'offen' && !!t.faelligkeit && t.faelligkeit < heute();
}

/** Sortierung einer Aufgabenliste: manuell (nach position) oder nach Frist (terminlose ans Ende). */
export function sortiereAufgaben(tasks: Task[], modus: 'manuell' | 'frist'): Task[] {
  const kopie = [...tasks];
  if (modus === 'frist') {
    // Terminlose nach hinten (hoher Ersatzschlüssel); bei Gleichstand die manuelle Reihenfolge.
    return kopie.sort((a, b) => (a.faelligkeit ?? '9999-99-99').localeCompare(b.faelligkeit ?? '9999-99-99') || a.position - b.position);
  }
  return kopie.sort((a, b) => a.position - b.position);
}

/** Aufgaben, die einem Nutzer zugewiesen sind (seine To-Do-Liste). */
export function aufgabenFuer(tasks: Task[], userId: string): Task[] {
  return tasks.filter((t) => t.zugewiesenAnId === userId);
}

/** Aufgaben, die ein Nutzer anderen gegeben hat (vergeben, nicht sich selbst). */
export function vonMirVergeben(tasks: Task[], userId: string): Task[] {
  return tasks.filter((t) => t.erstelltVonId === userId && t.zugewiesenAnId !== userId);
}

/** Aufgaben, die an einem konkreten Auftrag hängen. */
export function aufgabenZuAuftrag(tasks: Task[], orderId: string): Task[] {
  return tasks.filter((t) => t.orderId === orderId);
}

/** Anzahl offener, mir zugewiesener Aufgaben (Navigations-Badge). */
export function useOffeneAufgabenCount(): number {
  const tasks = useStore((s) => s.tasks);
  const userId = useStore((s) => s.currentUserId);
  return useMemo(() => (userId ? tasks.filter((t) => t.zugewiesenAnId === userId && t.status === 'offen').length : 0), [tasks, userId]);
}
