import { describe, it, expect } from 'vitest';
import { createLoginSchutz, LOGIN_SCHUTZ } from './loginSchutz';

describe('LoginSchutz (Fehlversuchs-Sperre, Review P3.7)', () => {
  it('sperrt nach MAX_VERSUCHE Fehlversuchen und gibt nach Ablauf wieder frei', () => {
    let now = 1_000_000;
    const schutz = createLoginSchutz(() => now);

    for (let i = 0; i < LOGIN_SCHUTZ.MAX_VERSUCHE - 1; i++) {
      expect(schutz.fehlversuch('u:wolf')).toBe(false);
      expect(schutz.gesperrt('u:wolf')).toBe(false);
    }
    expect(schutz.fehlversuch('u:wolf')).toBe(true); // 5. Versuch -> Sperre beginnt
    expect(schutz.gesperrt('u:wolf')).toBe(true);

    now += LOGIN_SCHUTZ.SPERRE_MS - 1;
    expect(schutz.gesperrt('u:wolf')).toBe(true); // knapp davor: noch zu

    now += 2;
    expect(schutz.gesperrt('u:wolf')).toBe(false); // Sperre abgelaufen
  });

  it('erfolgreicher Login setzt den Zaehler zurueck', () => {
    const schutz = createLoginSchutz(() => 0);
    for (let i = 0; i < LOGIN_SCHUTZ.MAX_VERSUCHE - 1; i++) schutz.fehlversuch('u:wolf');
    schutz.erfolg('u:wolf');
    // Frisches Fenster: die naechsten Versuche starten wieder bei 0.
    expect(schutz.fehlversuch('u:wolf')).toBe(false);
    expect(schutz.gesperrt('u:wolf')).toBe(false);
  });

  it('Schluessel sind unabhaengig (anderer Nutzer bleibt frei)', () => {
    const schutz = createLoginSchutz(() => 0);
    for (let i = 0; i < LOGIN_SCHUTZ.MAX_VERSUCHE; i++) schutz.fehlversuch('u:wolf');
    expect(schutz.gesperrt('u:wolf')).toBe(true);
    expect(schutz.gesperrt('u:klein')).toBe(false);
  });
});
