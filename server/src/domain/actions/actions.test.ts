import { describe, expect, it, beforeEach } from 'vitest';
import { createMemoryRepositories } from '../../infra/memory/repos';
import type { Repositories } from '../ports';
import type { PublicUser, User } from '../types';
import type { Clock } from '../clock';
import { createActions, type Actions } from './index';
import { isDomainError } from '../errors';

const mitarbeiter: PublicUser = { id: 'u-wolf', username: 'wolf', name: 'S. Wolf', role: 'mitarbeiter', admin: false };
const anderer: PublicUser = { id: 'u-klein', username: 'klein', name: 'M. Klein', role: 'mitarbeiter', admin: false };
const partner: PublicUser = { id: 'u-burchardt', username: 'burchardt', name: 'O. Burchardt', role: 'partner', admin: true };

/** Deterministische Uhr: fortlaufende IDs, feste (monoton steigende) Zeit. */
function testClock(): Clock {
  let n = 0;
  return {
    newId: () => `id-${++n}`,
    now: () => `2026-07-03T10:00:0${Math.min(n, 9)}.000Z`,
  };
}

function usersOf(list: PublicUser[]): User[] {
  return list.map((u) => ({ ...u, passwordHash: 'x' }));
}

let repos: Repositories;
let actions: Actions;

beforeEach(() => {
  repos = createMemoryRepositories(usersOf([mitarbeiter, anderer, partner]));
  actions = createActions(repos, testClock());
});

/** Kleiner Helfer: erwartet, dass ein Aufruf mit dem gegebenen DomainError-Code fehlschlaegt. */
async function expectDomainError(fn: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await fn();
  } catch (err) {
    expect(isDomainError(err)).toBe(true);
    if (isDomainError(err)) expect(err.code).toBe(code);
    return;
  }
  throw new Error(`erwartet: DomainError(${code}), aber kein Fehler`);
}

describe('Zeit-Aktionen', () => {
  it('bucht Zeit als "erfasst" auf den eigenen Nutzer', async () => {
    const e = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1.5 });
    expect(e).toMatchObject({ userId: 'u-wolf', orderId: 'o1', status: 'erfasst', dauer: 1.5 });
    expect(await repos.times.findById(e.id)).toBeTruthy();
  });

  it('weist nicht-positive Dauer ab', async () => {
    await expectDomainError(() => actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 0 }), 'invalid');
  });

  it('ist idempotent bei gleichem Idempotenz-Schluessel', async () => {
    const a = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1, idempotencyKey: 'k1' });
    const b = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1, idempotencyKey: 'k1' });
    expect(b.id).toBe(a.id);
    expect(await repos.times.listByUser('u-wolf')).toHaveLength(1);
  });

  it('Freigeben/Zuruecknehmen nur fuer eigene Eintraege', async () => {
    const e = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1 });
    const freigegeben = await actions.time.releaseTime(mitarbeiter, e.id);
    expect(freigegeben.status).toBe('freigegeben');
    const zurueck = await actions.time.withdrawTime(mitarbeiter, e.id);
    expect(zurueck.status).toBe('erfasst');
    await expectDomainError(() => actions.time.releaseTime(anderer, e.id), 'forbidden');
  });

  it('uebertragene Zeit ist gesperrt (kein Freigeben/Loeschen)', async () => {
    const e = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1 });
    await repos.times.update({ ...e, status: 'uebertragen' });
    await expectDomainError(() => actions.time.withdrawTime(mitarbeiter, e.id), 'conflict');
    await expectDomainError(() => actions.time.deleteTime(mitarbeiter, e.id), 'conflict');
  });

  it('loescht eigenen, nicht uebertragenen Eintrag', async () => {
    const e = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1 });
    await actions.time.deleteTime(mitarbeiter, e.id);
    expect(await repos.times.findById(e.id)).toBeUndefined();
  });
});

describe('Note-Aktionen', () => {
  it('Mitarbeiter erzeugt Frage, Partner erzeugt Review', async () => {
    const frage = await actions.notes.createNote(mitarbeiter, { orderId: 'o1', text: 'Beleg fehlt?' });
    expect(frage.kind).toBe('frage');
    const review = await actions.notes.createNote(partner, { orderId: 'o1', text: 'Bitte pruefen' });
    expect(review.kind).toBe('review');
  });

  it('Frage-Workflow: offen -> erledigt -> wieder offen (Mitarbeiter)', async () => {
    const frage = await actions.notes.createNote(mitarbeiter, { orderId: 'o1', text: 'x' });
    expect((await actions.notes.markDone(mitarbeiter, frage.id)).noteState).toBe('erledigt');
    expect((await actions.notes.reopen(mitarbeiter, frage.id)).noteState).toBe('offen');
  });

  it('Review-Workflow: Mitarbeiter meldet erledigt, Partner gibt frei', async () => {
    const review = await actions.notes.createNote(partner, { orderId: 'o1', text: 'Review' });
    await actions.notes.markDone(mitarbeiter, review.id);
    expect((await actions.notes.approve(partner, review.id)).noteState).toBe('freigegeben');
  });

  it('Partner kann nicht als erledigt melden; Mitarbeiter kann nicht freigeben', async () => {
    const review = await actions.notes.createNote(partner, { orderId: 'o1', text: 'Review' });
    await expectDomainError(() => actions.notes.markDone(partner, review.id), 'forbidden');
    await actions.notes.markDone(mitarbeiter, review.id);
    await expectDomainError(() => actions.notes.approve(mitarbeiter, review.id), 'forbidden');
  });

  it('reopen gilt nur fuer Fragen, nicht fuer Reviews', async () => {
    const review = await actions.notes.createNote(partner, { orderId: 'o1', text: 'Review' });
    await actions.notes.markDone(mitarbeiter, review.id);
    await expectDomainError(() => actions.notes.reopen(mitarbeiter, review.id), 'forbidden');
  });

  it('Loeschen: Frage nur Mitarbeiter, Review nur Partner', async () => {
    const frage = await actions.notes.createNote(mitarbeiter, { orderId: 'o1', text: 'x' });
    await expectDomainError(() => actions.notes.deleteNote(partner, frage.id), 'forbidden');
    await actions.notes.deleteNote(mitarbeiter, frage.id);
    expect(await repos.notes.findById(frage.id)).toBeUndefined();
  });

  it('Kommentieren fuegt Kommentar hinzu; leerer Text abgewiesen', async () => {
    const frage = await actions.notes.createNote(mitarbeiter, { orderId: 'o1', text: 'x' });
    await actions.notes.comment(partner, frage.id, 'Nachfrage');
    const [thread] = await actions.notes.listByOrder('o1');
    expect(thread.comments).toHaveLength(1);
    await expectDomainError(() => actions.notes.comment(partner, frage.id, '   '), 'invalid');
  });

  it('markDone nur aus "offen" heraus', async () => {
    const frage = await actions.notes.createNote(mitarbeiter, { orderId: 'o1', text: 'x' });
    await actions.notes.markDone(mitarbeiter, frage.id);
    await expectDomainError(() => actions.notes.markDone(mitarbeiter, frage.id), 'conflict');
  });
});

describe('Status-Aktionen', () => {
  it('setzt Status und schreibt Historie', async () => {
    await actions.status.setStatus(mitarbeiter, 'o1', 'bb');
    expect((await repos.overlays.get('o1'))?.boardStatus).toBe('bb');
    const hist = await actions.status.history('o1');
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ fromStatus: undefined, toStatus: 'bb', actorId: 'u-wolf' });
  });

  it('weist unbekannten Status ab', async () => {
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o1', 'xx'), 'invalid');
  });

  it('reine Positionsverschiebung erzeugt keinen Historien-Eintrag', async () => {
    await actions.status.setStatus(mitarbeiter, 'o1', 'bb', 1);
    await actions.status.setStatus(mitarbeiter, 'o1', 'bb', 2);
    expect(await actions.status.history('o1')).toHaveLength(1);
    expect((await repos.overlays.get('o1'))?.boardPosition).toBe(2);
  });

  it('"Erledigt" ist gesperrt, solange die Checkliste offen ist', async () => {
    await repos.checklists.insertMany([
      { id: 'c1', orderId: 'o1', label: 'ELSTER', done: false, position: 1 },
    ]);
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o1', 'er'), 'conflict');
    await repos.checklists.setDone('c1', true);
    const overlay = await actions.status.setStatus(mitarbeiter, 'o1', 'er');
    expect(overlay.boardStatus).toBe('er');
  });

  it('ohne Checkliste ist "Erledigt" moeglich', async () => {
    const overlay = await actions.status.setStatus(mitarbeiter, 'o1', 'er');
    expect(overlay.boardStatus).toBe('er');
  });
});
