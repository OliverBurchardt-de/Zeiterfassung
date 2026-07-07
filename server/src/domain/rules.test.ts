import { describe, it, expect } from 'vitest';
import { canCompleteOrder, isValidTimeDuration } from './rules';

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
