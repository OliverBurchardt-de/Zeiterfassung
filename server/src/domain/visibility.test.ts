import { describe, it, expect } from 'vitest';
import { visibleOrders } from './visibility';
import type { OrderView, PublicUser } from './types';

const orders: OrderView[] = [
  { id: '1', orderNumber: 1, ordertype: '202', name: 'A', status: 'started', clientId: 'c1', responsibleId: 'u-wolf', partnerId: 'u-burchardt', isInternal: false, plannedHours: 5 },
  { id: '2', orderNumber: 2, ordertype: '301', name: 'B', status: 'started', clientId: 'c2', responsibleId: 'u-klein', partnerId: 'u-burchardt', isInternal: false, plannedHours: 5 },
  { id: '3', orderNumber: 3, ordertype: '9801', name: 'Intern', status: 'started', clientId: 'intern', isInternal: true, plannedHours: 0 },
  { id: '4', orderNumber: 4, ordertype: '303', name: 'C', status: 'started', clientId: 'c3', responsibleId: 'u-berg', partnerId: 'u-partner2', isInternal: false, plannedHours: 8 },
];

const wolf: PublicUser = { id: 'u-wolf', username: 'wolf', name: 'S. Wolf', role: 'mitarbeiter', admin: false };
const burchardt: PublicUser = { id: 'u-burchardt', username: 'burchardt', name: 'O. Burchardt', role: 'partner', admin: false };
const admin: PublicUser = { id: 'u-admin', username: 'admin', name: 'Admin', role: 'partner', admin: true };

describe('visibleOrders', () => {
  it('interne Auftraege sind nie sichtbar', () => {
    expect(visibleOrders(orders, admin).some((o) => o.isInternal)).toBe(false);
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
});
