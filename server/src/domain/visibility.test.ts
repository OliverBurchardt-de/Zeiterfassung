import { describe, it, expect } from 'vitest';
import { visibleOrders, canAccessOrder } from './visibility';
import type { OrderView, PublicUser } from './types';

// Auftraege tragen DATEV-Mitarbeiter-IDs (emp-…) — bewusst NICHT die App-User-IDs (u-…),
// damit die Tests den Abgleich ueber datevEmployeeId belegen (Codex-Review P1).
const orders: OrderView[] = [
  { id: '1', orderNumber: 1, ordertype: '202', name: 'A', status: 'started', clientId: 'c1', responsibleId: 'emp-wolf', partnerId: 'emp-burchardt', isInternal: false, plannedHours: 5 },
  { id: '2', orderNumber: 2, ordertype: '301', name: 'B', status: 'started', clientId: 'c2', responsibleId: 'emp-klein', partnerId: 'emp-burchardt', isInternal: false, plannedHours: 5 },
  { id: '3', orderNumber: 3, ordertype: '9801', name: 'Intern', status: 'started', clientId: 'intern', isInternal: true, plannedHours: 0 },
  { id: '4', orderNumber: 4, ordertype: '303', name: 'C', status: 'started', clientId: 'c3', responsibleId: 'emp-berg', partnerId: 'emp-partner2', isInternal: false, plannedHours: 8 },
];

const wolf: PublicUser = { id: 'u-wolf', username: 'wolf', name: 'S. Wolf', role: 'mitarbeiter', admin: false, datevEmployeeId: 'emp-wolf' };
const burchardt: PublicUser = { id: 'u-burchardt', username: 'burchardt', name: 'O. Burchardt', role: 'partner', admin: false, datevEmployeeId: 'emp-burchardt' };
const admin: PublicUser = { id: 'u-admin', username: 'admin', name: 'Admin', role: 'partner', admin: true };
const backoffice: PublicUser = { id: 'u-bo', username: 'bo', name: 'B. Ostermann', role: 'backoffice', admin: false, datevEmployeeId: 'emp-bo' };

describe('visibleOrders', () => {
  it('interne Auftraege sind nie im Board (auch nicht fuer Admin)', () => {
    expect(visibleOrders(orders, admin).some((o) => o.isInternal)).toBe(false);
  });
  it('Backoffice sieht alle Board-Auftraege (bucht fuer alle), aber interne bleiben aus dem Board', () => {
    expect(visibleOrders(orders, backoffice).map((o) => o.id)).toEqual(['1', '2', '4']);
  });
  it('Mitarbeiter sieht nur eigene zugewiesene', () => {
    expect(visibleOrders(orders, wolf).map((o) => o.id)).toEqual(['1']);
  });
  it('Partner sieht nur seine verantworteten Mandate — nicht die anderer Partner', () => {
    expect(visibleOrders(orders, burchardt).map((o) => o.id)).toEqual(['1', '2']);
  });
  it('Admin sieht alle Board-Auftraege', () => {
    expect(visibleOrders(orders, admin).map((o) => o.id)).toEqual(['1', '2', '4']);
  });

  it('gleicht ueber die DATEV-ID ab, nicht ueber die App-User-ID', () => {
    // App-`id` kollidiert absichtlich mit einer DATEV-ID eines Auftrags, die datevEmployeeId
    // zeigt aber woanders hin → der Nutzer darf den Auftrag NICHT sehen.
    const falscherAbgleich: PublicUser = { id: 'emp-wolf', username: 'x', name: 'X', role: 'mitarbeiter', admin: false, datevEmployeeId: 'emp-niemand' };
    expect(visibleOrders(orders, falscherAbgleich)).toEqual([]);
  });

  it('Nicht-Admin ohne datevEmployeeId sieht nichts (fail-closed)', () => {
    const ohneMapping: PublicUser = { id: 'u-neu', username: 'neu', name: 'Neu', role: 'mitarbeiter', admin: false };
    expect(visibleOrders(orders, ohneMapping)).toEqual([]);
  });

  it('interne Auftraege sind fuer JEDEN bebuchbar (canAccessOrder), auch ohne Zuordnung', () => {
    const intern = orders.find((o) => o.isInternal)!;
    const ohneMapping: PublicUser = { id: 'u-neu', username: 'neu', name: 'Neu', role: 'mitarbeiter', admin: false };
    expect(canAccessOrder(intern, wolf)).toBe(true);
    expect(canAccessOrder(intern, ohneMapping)).toBe(true);
    // Ein fremder BOARD-Auftrag bleibt fuer den Nicht-Zustaendigen gesperrt.
    expect(canAccessOrder(orders.find((o) => o.id === '2')!, wolf)).toBe(false);
  });
});
