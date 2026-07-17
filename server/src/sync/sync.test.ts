import { describe, expect, it, vi } from 'vitest';
import type { DatevPort, ExpensePosting } from '../domain/ports';
import type { OrderView, DatevClient } from '../domain/types';
import { createOrderSnapshot } from './orderSnapshot';
import { runOrderSync } from './syncOrders';
import { createSnapshotBackedDatev } from './snapshotDatev';
import { runOutboxDrain } from './outboxWorker';
import { msUntilTime } from './scheduler';
import { createMemoryOutboxRepository } from '../infra/memory/repos';

const noopLog = (): void => undefined;

function fakeDatev(over: Partial<DatevPort> = {}): DatevPort {
  return {
    health: async () => true,
    getOrders: async () => [],
    getOrder: async () => undefined,
    getClients: async () => [],
    postExpensePosting: async () => ({ id: 'x' }),
    ...over,
  };
}

const order = (id: string): OrderView => ({ id } as OrderView);
const client = (id: string): DatevClient => ({ id, name: `Mandant ${id}`, number: id } as DatevClient);

describe('scheduler — msUntilTime', () => {
  it('rechnet bis zur spaeteren Uhrzeit am selben Tag', () => {
    const now = new Date('2026-07-17T04:00:00');
    // 05:00 ist eine Stunde spaeter.
    expect(msUntilTime('05:00', now)).toBe(60 * 60 * 1000);
  });

  it('liegt die Uhrzeit heute schon in der Vergangenheit, zaehlt sie fuer morgen', () => {
    const now = new Date('2026-07-17T06:00:00');
    // 05:00 war vor einer Stunde -> naechster Lauf in 23 Stunden.
    expect(msUntilTime('05:00', now)).toBe(23 * 60 * 60 * 1000);
  });

  it('genau jetzt zaehlt fuer morgen (nicht 0)', () => {
    const now = new Date('2026-07-17T05:00:00');
    expect(msUntilTime('05:00', now)).toBe(24 * 60 * 60 * 1000);
  });
});

describe('runOrderSync — fuellt den Snapshot', () => {
  it('legt Auftraege + Mandanten mit Zeitstempel ab', async () => {
    const snapshot = createOrderSnapshot();
    const datev = fakeDatev({
      getOrders: async () => [order('a'), order('b')],
      getClients: async () => [client('1')],
    });
    const res = await runOrderSync(datev, snapshot, noopLog, '2026-07-17T05:00:00.000Z');
    expect(res).toEqual({ orders: 2, clients: 1 });
    expect(snapshot.get()?.orders).toHaveLength(2);
    expect(snapshot.get()?.syncedAt).toBe('2026-07-17T05:00:00.000Z');
  });

  it('Ausfall der Stammdaten ist nicht fatal (Board zeigt dann clientId)', async () => {
    const snapshot = createOrderSnapshot();
    const datev = fakeDatev({
      getOrders: async () => [order('a')],
      getClients: async () => {
        throw new Error('master-data weg');
      },
    });
    const res = await runOrderSync(datev, snapshot, noopLog, 't');
    expect(res.orders).toBe(1);
    expect(snapshot.get()?.clients).toEqual([]);
  });
});

describe('snapshotDatev — Lese-Weiche', () => {
  it('liest aus dem Snapshot statt live und fuellt nur beim ersten Zugriff', async () => {
    const snapshot = createOrderSnapshot();
    const getOrders = vi.fn(async () => [order('a')]);
    const getClients = vi.fn(async () => [client('1')]);
    const weiche = createSnapshotBackedDatev(fakeDatev({ getOrders, getClients }), snapshot, noopLog, () => 't');

    // Erst-Zugriff (Board holt getOrders + getClients parallel) fuellt EINMAL — kein Doppelabruf.
    const [o1, c1] = await Promise.all([weiche.getOrders(), weiche.getClients()]);
    expect(o1).toHaveLength(1);
    expect(c1).toHaveLength(1);
    // Zweiter Zugriff bedient sich rein aus dem Snapshot.
    await weiche.getOrders();
    expect(getOrders).toHaveBeenCalledTimes(1);
    expect(getClients).toHaveBeenCalledTimes(1);
  });

  it('getOrder faellt fuer nicht enthaltene IDs auf den Live-Einzelabruf zurueck', async () => {
    const snapshot = createOrderSnapshot();
    const getOrder = vi.fn(async (id: string) => order(id));
    const weiche = createSnapshotBackedDatev(
      fakeDatev({ getOrders: async () => [order('a')], getOrder }),
      snapshot,
      noopLog,
      () => 't',
    );
    expect((await weiche.getOrder('a'))?.id).toBe('a'); // aus Snapshot
    expect(getOrder).not.toHaveBeenCalled();
    expect((await weiche.getOrder('z'))?.id).toBe('z'); // Live-Fallback
    expect(getOrder).toHaveBeenCalledWith('z');
  });
});

describe('runOutboxDrain — Rueckschreibe-Warteschlange', () => {
  const posting: ExpensePosting = {
    orderId: 'o1', suborderId: 's1', employeeId: 'e1',
    workDate: '17.07.2026 00:00:00', costPosition: 'cp', timeUnits: 1200,
  };
  const eintrag = (id: string, attempts = 0) => ({
    id, kind: 'expense-posting' as const, payload: JSON.stringify(posting),
    idempotencyKey: id, status: 'offen' as const, attempts, createdAt: '2026-07-17T05:00:00.000Z',
  });

  it('bucht offene Eintraege und markiert sie als uebertragen', async () => {
    const outbox = createMemoryOutboxRepository();
    await outbox.enqueue(eintrag('x1'));
    const post = vi.fn(async () => ({ id: 'datev-1' }));
    const res = await runOutboxDrain(outbox, fakeDatev({ postExpensePosting: post }), noopLog);
    expect(res.sent).toBe(1);
    expect(post).toHaveBeenCalledOnce();
    expect(await outbox.nextOpen(10)).toHaveLength(0); // nichts Offenes mehr
  });

  it('haelt einen Fehlschlag zur Wiederholung offen und gibt erst nach maxAttempts auf', async () => {
    const outbox = createMemoryOutboxRepository();
    await outbox.enqueue(eintrag('x1'));
    const datev = fakeDatev({
      postExpensePosting: async () => {
        throw new Error('DATEV weg');
      },
    });
    // maxAttempts=2: 1. Lauf -> Fehlversuch (bleibt offen), 2. Lauf -> endgueltiger Fehler.
    const r1 = await runOutboxDrain(outbox, datev, noopLog, { maxAttempts: 2 });
    expect(r1.retried).toBe(1);
    expect(await outbox.nextOpen(10)).toHaveLength(1); // noch offen

    const r2 = await runOutboxDrain(outbox, datev, noopLog, { maxAttempts: 2 });
    expect(r2.failed).toBe(1);
    expect(await outbox.nextOpen(10)).toHaveLength(0); // nicht mehr offen (endgueltig fehlerhaft)
  });
});
