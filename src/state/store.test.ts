import { describe, expect, it } from 'vitest';
import { useStore } from './store';
import { MOCK_ORDERS } from '@/mock/orders';
import type { Order } from '@/lib/types';

// Einen kontrollierten Auftrag in den Store setzen (aus echtem Mock abgeleitet).
function seed(partial: Partial<Order>): void {
  const o: Order = { ...MOCK_ORDERS[0], id: 'test-1', ...partial };
  useStore.setState({ orders: [o] });
}
const current = () => useStore.getState().orders[0];

describe('setStatus (Domänen-Guard)', () => {
  it('blockiert „Erledigt" bei unvollständiger Checkliste', () => {
    seed({ status: 'rf', checklist: [{ id: 'c1', label: 'x', done: false }] });
    useStore.getState().setStatus('test-1', 'er');
    expect(current().status).toBe('rf');
  });
  it('erlaubt „Erledigt" bei vollständiger Checkliste', () => {
    seed({ status: 'rf', checklist: [{ id: 'c1', label: 'x', done: true }] });
    useStore.getState().setStatus('test-1', 'er');
    expect(current().status).toBe('er');
  });
  it('erlaubt einen normalen Statuswechsel', () => {
    seed({ status: 'av', checklist: [] });
    useStore.getState().setStatus('test-1', 'bb');
    expect(current().status).toBe('bb');
  });
});

describe('approveUmplanung / rejectUmplanung', () => {
  it('approve setzt Monat + Fristdaten und löscht die Anfrage', () => {
    seed({ monat: 'Mär 2025', umplanung: { zielMonat: 'Mai 2025', freigabeAusstehend: true } });
    useStore.getState().approveUmplanung('test-1');
    const o = current();
    expect(o.monat).toBe('Mai 2025');
    expect(o.fristStart).toBe('2025-05-01');
    expect(o.fristEnde).toBe('2025-05-31');
    expect(o.umplanung).toBeNull();
  });
  it('reject verwirft die Anfrage, Monat bleibt unverändert', () => {
    seed({ monat: 'Mär 2025', umplanung: { zielMonat: 'Mai 2025', freigabeAusstehend: true } });
    useStore.getState().rejectUmplanung('test-1');
    const o = current();
    expect(o.monat).toBe('Mär 2025');
    expect(o.umplanung).toBeNull();
  });
});

describe('addManualTime (Guard)', () => {
  it('verwirft eine nicht-positive Dauer', () => {
    seed({ times: [] });
    useStore.getState().addManualTime('test-1', '2025-03-20', 0);
    expect(current().times).toHaveLength(0);
  });
  it('bucht eine gültige Zeit', () => {
    seed({ times: [] });
    useStore.getState().addManualTime('test-1', '2025-03-20', 1.5, 'Notiz');
    expect(current().times).toHaveLength(1);
    expect(current().times[0].dauer).toBe(1.5);
  });
});
