import { describe, expect, it } from 'vitest';
import { parseMonat, monatBounds, monthRange } from '@/lib/monate';

describe('parseMonat', () => {
  it('parst einen gültigen Monat', () => {
    expect(parseMonat('Mär 2025')).toEqual({ year: 2025, monthIndex: 2 });
  });
  it('liefert null bei ungültigem Format', () => {
    expect(parseMonat('xxx')).toBeNull();
    expect(parseMonat('')).toBeNull();
  });
});

describe('monatBounds', () => {
  it('liefert ersten und letzten Tag des Monats', () => {
    expect(monatBounds('Mai 2025')).toEqual({ start: '2025-05-01', end: '2025-05-31' });
    expect(monatBounds('Feb 2025')).toEqual({ start: '2025-02-01', end: '2025-02-28' });
  });
  it('liefert null bei leerem/ungültigem Monat', () => {
    expect(monatBounds('')).toBeNull();
  });
});

describe('monthRange', () => {
  it('liefert fortlaufende Monate über die Jahresgrenze', () => {
    expect(monthRange(2025, 10, 4)).toEqual(['Nov 2025', 'Dez 2025', 'Jan 2026', 'Feb 2026']);
  });
});
