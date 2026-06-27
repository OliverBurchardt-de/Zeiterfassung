import { useMemo } from 'react';
import type { Order, Note, TimeEntry, User } from '@/lib/types';
import { useStore, noteOffen } from './store';
import { erfassteStunden, isLaufendeArt } from '@/lib/art';
import { HEUTE } from '@/mock/orders';

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

/** Zeitbuchungen eines Bearbeiters (Modul „Meine Zeiten"). */
export function zeitenVon(orders: Order[], autor: string): ZeitRow[] {
  const out: ZeitRow[] = [];
  for (const o of orders) if (o.bearbeiter === autor) for (const t of o.times) out.push({ order: o, time: t });
  return out;
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

/** Überfällig: Fristende liegt vor dem Stichtag und der Auftrag ist nicht erledigt. */
export function istUeberfaellig(o: Order): boolean {
  // Ungeplante Aufträge haben leeres Fristende ('') → nicht als überfällig werten (Review-Hinweis 5.2).
  if (!o.fristEnde) return false;
  return o.fristEnde < HEUTE && o.status !== 'er';
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
    // Laufende Buchungs-Arten (Beratung/Mehraufwand) gehören nicht ins Kanban-Board
    if (isLaufendeArt(o.artKey)) return false;
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

/** KPI-Kennzahlen für die gefilterte Sicht */
export function kpis(orders: Order[]) {
  const zugeteilt = orders.length;
  const inBearbeitung = orders.filter((o) => o.status === 'bb').length;
  const zeitenOffen = orders.filter((o) => hasOffeneZeiten(o) || ohneZeit(o)).length;
  const reviewNotes = orders.filter((o) => o.notes.some(noteOffen)).length;
  return { zugeteilt, inBearbeitung, zeitenOffen, reviewNotes };
}

/** Heute (Stichtag HEUTE) erfasste Stunden der gefilterten Aufträge — unabhängig vom Freigabestatus. */
export const TAGES_SOLL = 8.0;

export function heuteErfasst(orders: Order[]): { gesamt: number; perMandant: { mandant: string; stunden: number }[] } {
  const perMandant: { mandant: string; stunden: number }[] = [];
  let gesamt = 0;
  for (const o of orders) {
    const h = erfassteStunden(o.times.filter((t) => t.datum === HEUTE));
    if (h > 0) {
      gesamt += h;
      perMandant.push({ mandant: o.mandant, stunden: h });
    }
  }
  return { gesamt, perMandant: perMandant.slice(0, 5) };
}
