import { describe, it, expect } from 'vitest';
import { createLoginSchutz, LOGIN_SCHUTZ } from './loginSchutz';

describe('LoginSchutz (Fehlversuchs-Sperre, Review P3.7)', () => {
  it('sperrt nach MAX_VERSUCHE Fehlversuchen und gibt nach Ablauf wieder frei', () => {
    let now = 1_000_000;
    const schutz = createLoginSchutz({ jetzt: () => now });

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
    const schutz = createLoginSchutz({ jetzt: () => 0 });
    for (let i = 0; i < LOGIN_SCHUTZ.MAX_VERSUCHE - 1; i++) schutz.fehlversuch('u:wolf');
    schutz.erfolg('u:wolf');
    // Frisches Fenster: die naechsten Versuche starten wieder bei 0.
    expect(schutz.fehlversuch('u:wolf')).toBe(false);
    expect(schutz.gesperrt('u:wolf')).toBe(false);
  });

  it('Schluessel sind unabhaengig (anderer Nutzer bleibt frei)', () => {
    const schutz = createLoginSchutz({ jetzt: () => 0 });
    for (let i = 0; i < LOGIN_SCHUTZ.MAX_VERSUCHE; i++) schutz.fehlversuch('u:wolf');
    expect(schutz.gesperrt('u:wolf')).toBe(true);
    expect(schutz.gesperrt('u:klein')).toBe(false);
  });

  it('getrennte Limits: IP-Schluessel darf lockerer sein als das Konto (P2-9)', () => {
    const ip = createLoginSchutz({ maxVersuche: 8, jetzt: () => 0 });
    for (let i = 0; i < 5; i++) ip.fehlversuch('ip:10.0.0.1');
    // Nach 5 Versuchen (Konto-Grenze) ist die IP noch NICHT gesperrt.
    expect(ip.gesperrt('ip:10.0.0.1')).toBe(false);
    for (let i = 0; i < 3; i++) ip.fehlversuch('ip:10.0.0.1'); // insgesamt 8
    expect(ip.gesperrt('ip:10.0.0.1')).toBe(true);
  });

  it('raeumt veraltete, nicht gesperrte Eintraege per TTL auf (P2-9, kein unbegrenztes Wachstum)', () => {
    let now = 0;
    const schutz = createLoginSchutz({ eintragTtlMs: 1000, jetzt: () => now });
    schutz.fehlversuch('ip:a'); // 1 Fehlversuch, nicht gesperrt
    expect(schutz.groesse()).toBe(1);
    now += 2000; // TTL abgelaufen
    // Ein Zugriff auf einen anderen Schluessel loest den Sweep aus.
    schutz.fehlversuch('ip:b');
    expect(schutz.groesse()).toBe(1); // 'ip:a' wurde aufgeraeumt
  });

  it('verwirft bei voller Map den aeltesten nicht-gesperrten Eintrag (Backstop)', () => {
    let now = 0;
    const schutz = createLoginSchutz({ maxEintraege: 2, eintragTtlMs: 1_000_000, jetzt: () => now });
    schutz.fehlversuch('ip:alt'); now += 1;
    schutz.fehlversuch('ip:mittel'); now += 1;
    schutz.fehlversuch('ip:neu'); // fuellt ueber die Grenze -> aeltester ('ip:alt') faellt raus
    expect(schutz.groesse()).toBe(2);
    expect(schutz.gesperrt('ip:alt')).toBe(false);
  });
});
