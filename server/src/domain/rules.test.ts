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

describe('isValidTimeDuration (Grenzen zentral in limits.ts)', () => {
  it('lehnt 0 und negative Dauer ab', () => {
    expect(isValidTimeDuration(0)).toBe(false);
    expect(isValidTimeDuration(-1)).toBe(false);
    expect(isValidTimeDuration(Number.NaN)).toBe(false);
  });
  it('akzeptiert positive Dauer bis zur Tagesgrenze', () => {
    expect(isValidTimeDuration(1.5)).toBe(true);
    expect(isValidTimeDuration(24)).toBe(true);
  });
  it('lehnt mehr als einen Tag und zu feine Bruchteile ab', () => {
    expect(isValidTimeDuration(24.01)).toBe(false);
    expect(isValidTimeDuration(1.001)).toBe(false); // DECIMAL(9,2): max. 2 Nachkommastellen
    expect(isValidTimeDuration(0.25)).toBe(true);
  });
});
