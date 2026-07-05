import type { DatevPort, ExpensePosting } from '../domain/ports';
import type { OrderView } from '../domain/types';

/**
 * „Schein-DATEV" fuer Entwicklung und Tests (ADR-05/10). Liefert Beispiel-Auftraege gemaess der
 * am Echtsystem verifizierten Feld-Referenz (siehe docs/datev-connect-handoff.md §3b).
 * Der echte HTTP-Adapter gegen localhost:58454 kommt in einem spaeteren M2-Schritt und erfuellt
 * dieselbe DatevPort-Schnittstelle — die uebrige App bleibt unveraendert.
 */
const SAMPLE_ORDERS: OrderView[] = [
  {
    id: '9993',
    orderNumber: 354,
    creationYear: 2026,
    ordertype: '202',
    name: 'Lohnbuchführung',
    status: 'work partially completed',
    clientId: 'client-1',
    clientName: 'Hotel Seeblick KG',
    clientNumber: '10230',
    responsibleId: 'u-wolf',
    partnerId: 'u-burchardt',
    isInternal: false,
    plannedHours: 18,
    assessmentYear: 2026,
    billingStatus: 'partially invoiced',
    plannedStart: '2026-03-01',
    plannedEnd: '2026-03-31',
  },
  {
    id: '9001',
    orderNumber: 401,
    creationYear: 2026,
    ordertype: '301',
    name: 'Jahresabschluss',
    status: 'started',
    clientId: 'client-2',
    clientName: 'Praxis Dr. Wagner',
    clientNumber: '10475',
    responsibleId: 'u-klein',
    partnerId: 'u-burchardt',
    isInternal: false,
    plannedHours: 40,
    assessmentYear: 2025,
    billingStatus: 'open',
    plannedStart: '2026-04-01',
    plannedEnd: '2026-04-30',
  },
  {
    id: '8476',
    orderNumber: 3,
    creationYear: 2026,
    ordertype: '9801',
    name: 'Kanzleiverwaltung',
    status: 'started',
    clientId: 'intern',
    isInternal: true,
    plannedHours: 0,
  },
];

export function createMockDatevAdapter(): DatevPort {
  let postingCounter = 30; // imitiert die nicht-idempotente, fortlaufende DATEV-Vergabe
  return {
    async health() {
      return true;
    },
    async getOrders() {
      return SAMPLE_ORDERS;
    },
    async getOrder(id) {
      return SAMPLE_ORDERS.find((o) => o.id === id);
    },
    async postExpensePosting(_posting: ExpensePosting) {
      postingCounter += 1;
      return { id: `mock-posting-${postingCounter}` };
    },
  };
}
