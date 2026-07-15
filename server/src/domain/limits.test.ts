import { describe, it, expect } from 'vitest';
import { isValidIsoDate, isValidDauer, LIMITS } from './limits';

describe('isValidIsoDate (echte Kalenderpruefung, Review P2.4)', () => {
  it('akzeptiert echte Kalendertage', () => {
    expect(isValidIsoDate('2026-07-12')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true); // Schaltjahr
  });
  it('lehnt formatrichtige Nicht-Tage ab', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2025-02-29')).toBe(false); // kein Schaltjahr
  });
  it('lehnt falsche Formate ab', () => {
    expect(isValidIsoDate('12.07.2026')).toBe(false);
    expect(isValidIsoDate('2026-7-1')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });
});

describe('isValidDauer', () => {
  it('Grenzen: >0, <= Tagesmaximum, max. 2 Nachkommastellen', () => {
    expect(isValidDauer(0.01)).toBe(true);
    expect(isValidDauer(LIMITS.DAUER_MAX_STUNDEN)).toBe(true);
    expect(isValidDauer(0)).toBe(false);
    expect(isValidDauer(LIMITS.DAUER_MAX_STUNDEN + 0.01)).toBe(false);
    expect(isValidDauer(1.005)).toBe(false);
    expect(isValidDauer(7.25)).toBe(true);
  });
});
