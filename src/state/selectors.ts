import type { Order } from '@/lib/types';
import { useStore, noteOffen } from './store';
import { erfassteStunden, isLaufendeArt } from '@/lib/art';

/** Hat der Auftrag offene (nicht freigegebene) Zeiten? */
export function hasOffeneZeiten(o: Order): boolean {
  return o.times.some((t) => !t.freigegeben);
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

/** Auftragsliste nach den aktuellen Filtern (ohne Status — der ergibt die Spalte) */
export function useFilteredOrders(): Order[] {
  const orders = useStore((s) => s.orders);
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

/** Heute erfasste Stunden (Demo: noch nicht freigegebene Zeiten der gefilterten Aufträge) */
export const TAGES_SOLL = 8.0;

export function heuteErfasst(orders: Order[]): { gesamt: number; perMandant: { mandant: string; stunden: number }[] } {
  const perMandant: { mandant: string; stunden: number }[] = [];
  let gesamt = 0;
  for (const o of orders) {
    const h = erfassteStunden(o.times.filter((t) => !t.freigegeben));
    if (h > 0) {
      gesamt += h;
      perMandant.push({ mandant: o.mandant, stunden: h });
    }
  }
  return { gesamt, perMandant: perMandant.slice(0, 5) };
}
