import { describe, expect, it } from 'vitest';
import { canComplete, istUeberfaellig, auslastungPct, heuteErfasst } from './selectors';
import { HEUTE, MOCK_ORDERS } from '@/mock/orders';
import type { Order } from '@/lib/types';

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
