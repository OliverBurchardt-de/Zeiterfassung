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
    // DATEV-Mitarbeiter-IDs (order_responsible1_id / order_partner_id) — bewusst NICHT die
    // App-User-IDs; der Abgleich laeuft ueber user.datevEmployeeId (s. domain/visibility.ts).
    responsibleId: 'emp-wolf',
    partnerId: 'emp-burchardt',
    isInternal: false,
    plannedHours: 18,
    assessmentYear: 2026,
    billingStatus: 'partially invoiced',
    plannedStart: '2026-03-01',
    plannedEnd: '2026-03-31',
    // Monats-Teilauftraege (202 Lohn): Januar/Februar abgeschlossen, Maerz ist der naechste
    // offene — Basis der Karten-Anzeige „Teilauftrag ..." im Server-Modus.
    suborders: [
      { number: 1, name: 'Januar 2026', periodFrom: '2026-01-01', periodTo: '2026-01-31', plannedHours: 1.5, dateWorkCompleted: '2026-02-05' },
      { number: 2, name: 'Februar 2026', periodFrom: '2026-02-01', periodTo: '2026-02-28', plannedHours: 1.5, dateWorkCompleted: '2026-03-04' },
      { number: 3, name: 'März 2026', periodFrom: '2026-03-01', periodTo: '2026-03-31', plannedHours: 1.5 },
      { number: 4, name: 'April 2026', periodFrom: '2026-04-01', periodTo: '2026-04-30', plannedHours: 1.5 },
    ],
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
    responsibleId: 'emp-klein',
    partnerId: 'emp-burchardt',
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
    async getClients() {
      // Stammdaten passend zu den Beispiel-Auftraegen (clientName tragen die Orders hier ohnehin).
      return [
        { id: 'client-1', name: 'Hotel Seeblick KG', number: '10230' },
        { id: 'client-2', name: 'Praxis Dr. Wagner', number: '10475' },
      ];
    },
    async postExpensePosting(_posting: ExpensePosting) {
      postingCounter += 1;
      return { id: `mock-posting-${postingCounter}` };
    },
  };
}
