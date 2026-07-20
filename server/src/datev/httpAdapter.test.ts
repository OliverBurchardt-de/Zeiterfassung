import { describe, it, expect } from 'vitest';
import { mapDatevOrder, mapDatevClient, splitDomainUser } from './httpAdapter';

describe('splitDomainUser', () => {
  it('zerlegt DOMAIN\\benutzer', () => {
    expect(splitDomainUser('MUSTERDOM\\mmustermann')).toEqual({ domain: 'MUSTERDOM', username: 'mmustermann' });
  });
  it('ohne Backslash: nur Benutzer, leere Domaene', () => {
    expect(splitDomainUser('techuser')).toEqual({ domain: '', username: 'techuser' });
  });
});

/**
 * Prueft die Feld-Umsetzung DATEV-Order-JSON -> OrderView anhand der am Echtsystem verifizierten
 * Feld-Referenz (docs/datev-connect-handoff.md §3b). Reiner Mapping-Test, kein Netz.
 */
describe('mapDatevOrder', () => {
  it('mappt ein vollstaendiges Order-Objekt korrekt', () => {
    const raw = {
      id: 9993,
      order_id: 9993,
      order_number: 354,
      creation_year: 2026,
      ordertype: '202',
      order_name: 'Lohnbuchführung',
      completion_status: 'work partially completed',
      client_id: 'client-guid',
      order_responsible1_id: 'emp-guid',
      order_partner_id: 'partner-guid',
      isinternal: false,
      planned_hours: 18,
      assessment_year: 2026,
      billing_status: 'partially invoiced',
    };
    expect(mapDatevOrder(raw)).toEqual({
      id: '9993',
      orderNumber: 354,
      creationYear: 2026,
      ordertype: '202',
      name: 'Lohnbuchführung',
      status: 'work partially completed',
      clientId: 'client-guid',
      responsibleId: 'emp-guid',
      partnerId: 'partner-guid',
      isInternal: false,
      plannedHours: 18,
      assessmentYear: 2026,
      billingStatus: 'partially invoiced',
    });
  });

  it('mappt eingebettete Teilauftraege (expand=suborders) mit Periode und Abschlussdatum', () => {
    const raw = {
      id: 12409,
      ordertype: '202',
      order_name: 'Lohnbuchführung',
      client_id: 'c1',
      suborders: [
        { suborder_number: 1, suborder_name: 'Januar 2026', period_from: '2026-01-01T00:00:00', period_to: '2026-01-31T00:00:00', planned_hours: 1.5, date_work_completed: '2026-02-05T00:00:00' },
        { suborder_number: 2, suborder_name: 'Februar 2026', period_from: '2026-02-01T00:00:00', period_to: '2026-02-28T00:00:00', planned_hours: 1.5 },
      ],
    };
    const mapped = mapDatevOrder(raw);
    expect(mapped.suborders).toEqual([
      { number: 1, name: 'Januar 2026', periodFrom: '2026-01-01', periodTo: '2026-01-31', plannedHours: 1.5, dateWorkCompleted: '2026-02-05' },
      { number: 2, name: 'Februar 2026', periodFrom: '2026-02-01', periodTo: '2026-02-28', plannedHours: 1.5, dateWorkCompleted: undefined },
    ]);
    // Ohne suborders-Feld (kein expand): Feld bleibt weg.
    expect(mapDatevOrder({ id: 1, client_id: 'c' }).suborders).toBeUndefined();
  });

  it('behandelt interne Auftraege und fehlende Felder robust', () => {
    const raw = {
      id: 8476,
      order_number: 3,
      creation_year: 2026,
      ordertype: '9801',
      order_name: 'Kanzleiverwaltung',
      completion_status: 'started',
      client_id: 'intern',
      isinternal: true,
      // planned_hours, assessment_year, billing_status, responsible/partner fehlen
    };
    const v = mapDatevOrder(raw);
    expect(v.isInternal).toBe(true);
    expect(v.plannedHours).toBe(0);
    expect(v.responsibleId).toBeUndefined();
    expect(v.partnerId).toBeUndefined();
    expect(v.billingStatus).toBeUndefined();
    expect(v.assessmentYear).toBeUndefined();
  });

  it('nimmt order_id, wenn id fehlt, und akzeptiert isinternal als String', () => {
    const v = mapDatevOrder({ order_id: 555, order_number: 1, ordertype: '106', isinternal: 'true' });
    expect(v.id).toBe('555');
    expect(v.isInternal).toBe(true);
  });
});

describe('mapDatevClient', () => {
  it('mappt Master-Data-Zeile; differing_name hat Vorrang', () => {
    expect(mapDatevClient({ id: 'g1', name: 'Hotel Seeblick KG', number: 10230 }))
      .toEqual({ id: 'g1', name: 'Hotel Seeblick KG', number: '10230' });
    expect(mapDatevClient({ id: 'g2', name: 'Amtlich GmbH', differing_name: 'Anzeigename GmbH' }).name)
      .toBe('Anzeigename GmbH');
    expect(mapDatevClient({ id: 'g3' })).toEqual({ id: 'g3', name: '', number: undefined });
  });
});
