import { describe, expect, it } from 'vitest';
import { canComplete, istUeberfaellig, auslastungPct, heuteErfasst, sichtbareAuftraege, umplanungFreiMoeglich } from './selectors';
import { HEUTE, MOCK_ORDERS } from '@/mock/orders';
import type { Order, User } from '@/lib/types';

// Aus einem echten Mock-Auftrag ableiten und nur die relevanten Felder überschreiben.
const make = (p: Partial<Order>): Order => ({ ...MOCK_ORDERS[0], ...p });

describe('canComplete', () => {
  it('true bei leerer oder vollständiger Checkliste', () => {
    expect(canComplete(make({ checklist: [] }))).toBe(true);
    expect(canComplete(make({ checklist: [{ id: '1', label: 'a', done: true }] }))).toBe(true);
  });
  it('false bei offenem Checklistenpunkt', () => {
    expect(canComplete(make({ checklist: [{ id: '1', label: 'a', done: false }] }))).toBe(false);
  });
});

describe('istUeberfaellig', () => {
  it('false bei leerem Fristende (ungeplant) — keine Fehlmeldung', () => {
    expect(istUeberfaellig(make({ fristEnde: '', status: 'bb' }))).toBe(false);
  });
  it('true wenn Fristende vor HEUTE und nicht erledigt', () => {
    expect(istUeberfaellig(make({ fristEnde: '2020-01-01', status: 'bb' }))).toBe(true);
  });
  it('false wenn bereits erledigt', () => {
    expect(istUeberfaellig(make({ fristEnde: '2020-01-01', status: 'er' }))).toBe(false);
  });
});

describe('auslastungPct', () => {
  it('0 bei Soll 0 — keine Division durch null', () => {
    expect(auslastungPct(make({ soll: 0, times: [] }))).toBe(0);
  });
});

describe('sichtbareAuftraege', () => {
  const a = make({ id: 'a', bearbeiter: 'S. Wolf', partner: 'O. Burchardt' });
  const b = make({ id: 'b', bearbeiter: 'M. Klein', partner: 'O. Burchardt' });
  const user = (p: Partial<User>): User => ({
    id: 'x', name: 'X', initials: 'X', email: 'x@x.de', role: 'mitarbeiter',
    admin: false, aktiv: true, datevId: '', tagessoll: 8, arbeitstageProWoche: 5, ...p,
  });

  it('Mitarbeiter sieht nur eigene zugewiesene', () => {
    expect(sichtbareAuftraege([a, b], user({ name: 'S. Wolf' })).map((o) => o.id)).toEqual(['a']);
  });
  it('Admin sieht alle', () => {
    expect(sichtbareAuftraege([a, b], user({ admin: true })).length).toBe(2);
  });
  it('Partner sieht seine verantworteten Mandate', () => {
    expect(sichtbareAuftraege([a, b], user({ name: 'O. Burchardt', role: 'partner' })).length).toBe(2);
  });
  it('ohne angemeldeten Nutzer nichts', () => {
    expect(sichtbareAuftraege([a, b], undefined)).toEqual([]);
  });
});

describe('umplanungFreiMoeglich (JA/ESt-Regel)', () => {
  it('Erstplanung (ohne Monat) ist immer frei', () => {
    expect(umplanungFreiMoeglich(make({ artKey: 'fibu', monat: '' }))).toBe(true);
  });
  it('JA: erste Umplanung im VJ frei, danach nicht mehr', () => {
    expect(umplanungFreiMoeglich(make({ artKey: 'ja', monat: 'Mär 2025', umplanungenVerbraucht: 0 }))).toBe(true);
    expect(umplanungFreiMoeglich(make({ artKey: 'ja', monat: 'Mär 2025', umplanungenVerbraucht: 1 }))).toBe(false);
  });
  it('andere Arten: Umplanung nie ohne Freigabe', () => {
    expect(umplanungFreiMoeglich(make({ artKey: 'fibu', monat: 'Mär 2025', umplanungenVerbraucht: 0 }))).toBe(false);
  });
});

describe('heuteErfasst', () => {
  it('summiert nur Zeiten mit datum === HEUTE', () => {
    const o = make({
      times: [
        { id: 't1', datum: HEUTE, dauer: 2, status: 'erfasst' },
        { id: 't2', datum: '2020-01-01', dauer: 5, status: 'erfasst' },
      ],
    });
    expect(heuteErfasst([o]).gesamt).toBe(2);
  });
});
