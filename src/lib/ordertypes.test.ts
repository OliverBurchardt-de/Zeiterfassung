import { describe, expect, it } from 'vitest';
import { ORDERTYPES, verhaltenFor, istPlanbar, istSonstige } from './ordertypes';

/**
 * Verhalten je Auftragsart — abgestimmte Einordnung vom 15.07.2026
 * (docs/zeiterfassung-board-konzept.md §1). Diese Tests sind das ausfuehrbare Protokoll
 * der Entscheidung: Aenderungen an der Einordnung muessen hier bewusst nachgezogen werden.
 */
describe('verhaltenFor', () => {
  it('planbar: die zu planenden Auftragsarten (Board)', () => {
    for (const code of ['106', '107', '108', '310', '320', '202', '301', '302', '303', '501', '502', '504', '505', '800', '802', 'FinVermV', 'MaBV', 'JAP']) {
      expect(verhaltenFor(code), code).toBe('planbar');
    }
  });

  it('laufend: Hintergrund-Buchungen (Beratung/Mehraufwand)', () => {
    for (const code of ['601', '615', '616']) {
      expect(verhaltenFor(code), code).toBe('laufend');
    }
  });

  it('sonstige: aktive Mandatsarbeit ausserhalb des Boards — bebuchbar', () => {
    for (const code of ['101', '201', '613', '507', '603', '605', '607', '617', 'SAR', '701', 'TRANS', 'Corona']) {
      expect(verhaltenFor(code), code).toBe('sonstige');
    }
  });

  it('Grenzfall 614 (DRV-Aussenpruefung): vorerst sonstige (Entscheidung 15.07.2026, umschaltbar)', () => {
    expect(verhaltenFor('614')).toBe('sonstige');
  });

  it('unbekannte Codes gelten fail-safe als sonstige (bebuchbar, nicht im Board)', () => {
    expect(verhaltenFor('GIBTSNICHT')).toBe('sonstige');
  });

  it('jeder Katalog-Ordertype hat ein eindeutiges Verhalten (nichts faellt durch)', () => {
    for (const t of ORDERTYPES) {
      expect(['planbar', 'laufend', 'sonstige', 'intern']).toContain(verhaltenFor(t.ordertype));
    }
  });

  it('Kurzformen istPlanbar/istSonstige stimmen mit verhaltenFor ueberein', () => {
    expect(istPlanbar('106')).toBe(true);
    expect(istPlanbar('613')).toBe(false);
    expect(istSonstige('613')).toBe(true);
    expect(istSonstige('106')).toBe(false);
  });
});
