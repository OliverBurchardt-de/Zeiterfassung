import { describe, it, expect } from 'vitest';
import {
  canCompleteOrder,
  isValidTimeDuration,
  umplanungFreiMoeglich,
  umplanungRegelGilt,
} from './rules';

describe('canCompleteOrder', () => {
  it('true bei leerer oder vollständiger Checkliste', () => {
    expect(canCompleteOrder([])).toBe(true);
    expect(canCompleteOrder([{ done: true }, { done: true }])).toBe(true);
  });
  it('false bei offenem Punkt', () => {
    expect(canCompleteOrder([{ done: true }, { done: false }])).toBe(false);
  });
});

describe('isValidTimeDuration', () => {
  it('lehnt 0 und negative Dauer ab', () => {
    expect(isValidTimeDuration(0)).toBe(false);
    expect(isValidTimeDuration(-1)).toBe(false);
    expect(isValidTimeDuration(Number.NaN)).toBe(false);
  });
  it('akzeptiert positive Dauer', () => {
    expect(isValidTimeDuration(1.5)).toBe(true);
  });
});

describe('umplanungRegelGilt', () => {
  it('gilt nur fuer ja und est', () => {
    expect(umplanungRegelGilt('ja')).toBe(true);
    expect(umplanungRegelGilt('est')).toBe(true);
    expect(umplanungRegelGilt('fibu')).toBe(false);
  });
});

describe('umplanungFreiMoeglich', () => {
  it('Erstplanung (kein Monat) ist immer frei', () => {
    expect(umplanungFreiMoeglich({ hasMonat: false, artKey: 'fibu', verbraucht: 0 })).toBe(true);
  });
  it('JA: erste Umplanung im Jahr frei, danach nicht mehr', () => {
    expect(umplanungFreiMoeglich({ hasMonat: true, artKey: 'ja', verbraucht: 0 })).toBe(true);
    expect(umplanungFreiMoeglich({ hasMonat: true, artKey: 'ja', verbraucht: 1 })).toBe(false);
  });
  it('andere Arten: nie ohne Freigabe', () => {
    expect(umplanungFreiMoeglich({ hasMonat: true, artKey: 'fibu', verbraucht: 0 })).toBe(false);
  });
});
