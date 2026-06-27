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

describe('umplanen (freie Umplanung) + VJ-Kontingent', () => {
  it('setzt Monat + Fristdaten und zählt das Kontingent hoch', () => {
    seed({ artKey: 'ja', monat: 'Mär 2025', umplanungenVerbraucht: 0 });
    useStore.getState().umplanen('test-1', 'Mai 2025');
    const o = current();
    expect(o.monat).toBe('Mai 2025');
    expect(o.fristStart).toBe('2025-05-01');
    expect(o.umplanungenVerbraucht).toBe(1);
  });
  it('approveUmplanung zählt das Kontingent ebenfalls hoch', () => {
    seed({ artKey: 'ja', monat: 'Mär 2025', umplanungenVerbraucht: 1, umplanung: { zielMonat: 'Jun 2025', freigabeAusstehend: true } });
    useStore.getState().approveUmplanung('test-1');
    expect(current().umplanungenVerbraucht).toBe(2);
  });
  it('unplanOrder setzt das Kontingent zurück', () => {
    seed({ artKey: 'ja', monat: 'Mai 2025', umplanungenVerbraucht: 1 });
    useStore.getState().unplanOrder('test-1');
    const o = current();
    expect(o.monat).toBe('');
    expect(o.umplanungenVerbraucht).toBe(0);
  });
});

describe('Auftrags-Anforderungen', () => {
  const user = { id: 'u1', name: 'S. Wolf', initials: 'SW', email: 's@x.de', role: 'mitarbeiter' as const, admin: false, aktiv: true, datevId: '', tagessoll: 8, arbeitstageProWoche: 5 };
  it('legt eine Anforderung an und setzt sie auf angelegt', () => {
    useStore.setState({ anforderungen: [] });
    useStore.getState().addAnforderung({ mandant: 'Mustermann', mandantNr: '42', ordertype: '106', art: 'Monatliche Finanzbuchführung', vj: 2025, notiz: 'fehlt' }, user);
    const items = useStore.getState().anforderungen;
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('angefordert');
    useStore.getState().setAnforderungAngelegt(items[0].id);
    expect(useStore.getState().anforderungen[0].status).toBe('angelegt');
  });
  it('verwirft eine Anforderung ohne Mandant/Notiz', () => {
    useStore.setState({ anforderungen: [] });
    useStore.getState().addAnforderung({ mandant: '', mandantNr: '', ordertype: '106', art: 'x', vj: 2025, notiz: '' }, user);
    expect(useStore.getState().anforderungen).toHaveLength(0);
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
