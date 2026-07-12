import { describe, expect, it, beforeEach } from 'vitest';
import { createMemoryRepositories } from '../../infra/memory/repos';
import type { Repositories, DatevPort } from '../ports';
import type { PublicUser, User, OrderView } from '../types';
import type { Clock } from '../clock';
import { createActions, type Actions } from './index';
import { isDomainError } from '../errors';

// App-User-ID (u-…) und DATEV-Mitarbeiter-ID (emp-…) sind verschieden — der Auftrag traegt die
// DATEV-ID, der Sichtbarkeits-Abgleich laeuft ueber datevEmployeeId (Codex-Review P1).
const mitarbeiter: PublicUser = { id: 'u-wolf', username: 'wolf', name: 'S. Wolf', role: 'mitarbeiter', admin: false, datevEmployeeId: 'emp-wolf' };
const anderer: PublicUser = { id: 'u-klein', username: 'klein', name: 'M. Klein', role: 'mitarbeiter', admin: false, datevEmployeeId: 'emp-klein' };
const partner: PublicUser = { id: 'u-burchardt', username: 'burchardt', name: 'O. Burchardt', role: 'partner', admin: true, datevEmployeeId: 'emp-burchardt' };

/**
 * Test-DATEV: 'o1' gehoert dem Mitarbeiter (Partner ist Admin) — 'anderer' (u-klein) sieht es NICHT.
 * 'o2' ist ein Jahresabschluss (Ordertype 301) MIT Default-Checklisten-Vorlage — fuer das
 * server-seitige Gate-Seeding (Codex-Review P2); 202 (Lohn) hat bewusst keine Vorlage.
 */
const ORDERS: OrderView[] = [
  { id: 'o1', orderNumber: 1, ordertype: '202', name: 'Testauftrag', status: 'started', clientId: 'c1', responsibleId: 'emp-wolf', partnerId: 'emp-burchardt', isInternal: false, plannedHours: 10 },
  { id: 'o2', orderNumber: 2, ordertype: '301', name: 'Jahresabschluss', status: 'started', clientId: 'c1', responsibleId: 'emp-wolf', partnerId: 'emp-burchardt', isInternal: false, plannedHours: 20 },
];
const datev: DatevPort = {
  health: async () => true,
  getOrders: async () => ORDERS,
  getOrder: async (id) => ORDERS.find((o) => o.id === id),
  postExpensePosting: async () => ({ id: 'mock' }),
};

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
  actions = createActions(repos, datev, testClock());
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
    expect(await repos.times.listByOrder('o1')).toHaveLength(1);
  });

  it('Tagesgrenze: mehr als 12 h pro Tag sind nicht buchbar — auch ueber mehrere Auftraege', async () => {
    // wolf sieht o1 und o2 — 8 h + 4 h = 12 h sind erlaubt (Grenze einschliesslich) …
    await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 8 });
    await actions.time.bookTime(mitarbeiter, { orderId: 'o2', datum: '2026-07-01', dauer: 4 });
    // … aber jede weitere Minute am selben Tag kippt die Summe -> Konflikt.
    await expectDomainError(
      () => actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 0.25 }),
      'conflict'
    );
    // Anderer Tag und anderer Nutzer sind unabhaengig.
    await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-02', dauer: 1 });
    await actions.time.bookTime(partner, { orderId: 'o1', datum: '2026-07-01', dauer: 1 });
  });

  it('Tagesgrenze rechnet gleitkomma-fest (11.9 + 0.1 = 12 ist erlaubt)', async () => {
    await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 11.9 });
    const e = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 0.1 });
    expect(e.dauer).toBe(0.1);
  });

  it('Idempotenz-Wiederholung zaehlt nicht doppelt gegen die Tagesgrenze', async () => {
    const a = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 12, idempotencyKey: 'kx' });
    // Retry mit demselben Schluessel: Tag ist "voll", aber der Request ist DIESELBE Buchung.
    const b = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 12, idempotencyKey: 'kx' });
    expect(b.id).toBe(a.id);
  });

  it('Idempotenz-Schluessel mit ABWEICHENDER Nutzlast ist ein Konflikt (Review P2.5)', async () => {
    await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1, idempotencyKey: 'k1' });
    await expectDomainError(
      () => actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 2, idempotencyKey: 'k1' }),
      'conflict'
    );
    await expectDomainError(
      () => actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-02', dauer: 1, idempotencyKey: 'k1' }),
      'conflict'
    );
    expect(await repos.times.listByOrder('o1')).toHaveLength(1);
  });

  it('fremder Idempotenz-Schluessel gibt NIE die fremde Buchung zurueck (Review P2.5)', async () => {
    // wolf bucht auf o1; burchardt (Admin, sieht o1 ebenfalls) verwendet denselben Schluessel.
    const a = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1, idempotencyKey: 'k1' });
    await expectDomainError(
      () => actions.time.bookTime(partner, { orderId: 'o1', datum: '2026-07-01', dauer: 1, idempotencyKey: 'k1' }),
      'forbidden'
    );
    expect((await repos.times.findById(a.id))?.userId).toBe('u-wolf');
  });

  it('Parallelfall: Unique-Kollision beim Insert wird kontrolliert aufgeloest (Review P2.5)', async () => {
    // Beide Requests passieren die Vorpruefung (Key noch frei), der zweite Insert kollidiert
    // mit dem Unique-Index. Simulation: findByIdempotencyKey liefert beim ERSTEN Aufruf nichts.
    let erster = true;
    const echteSuche = repos.times.findByIdempotencyKey.bind(repos.times);
    repos.times.findByIdempotencyKey = async (key) => {
      if (erster) {
        erster = false;
        return undefined; // Request A hat noch nicht committet
      }
      return echteSuche(key);
    };
    const a = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1, idempotencyKey: 'k1' });
    // Zweiter "paralleler" Request: Vorpruefung (jetzt echte Suche) wuerde finden — wir erzwingen
    // den Insert-Pfad, indem die Vorpruefung erneut leer antwortet.
    erster = true;
    const b = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1, idempotencyKey: 'k1' });
    expect(b.id).toBe(a.id); // kein interner Fehler, keine Dublette
    expect(await repos.times.listByOrder('o1')).toHaveLength(1);
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

  it('loescht eigenen Eintrag nur im Status "erfasst"', async () => {
    const e = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1 });
    await actions.time.deleteTime(mitarbeiter, e.id);
    expect(await repos.times.findById(e.id)).toBeUndefined();
  });

  it('freigegebene Zeit ist gegen Loeschen gesperrt (Review 12.07., P1.1)', async () => {
    const e = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1 });
    await actions.time.releaseTime(mitarbeiter, e.id);
    await expectDomainError(() => actions.time.deleteTime(mitarbeiter, e.id), 'conflict');
    expect(await repos.times.findById(e.id)).toMatchObject({ status: 'freigegeben' });
    // Weg zum Loeschen: erst Freigabe zuruecknehmen, dann loeschen.
    await actions.time.withdrawTime(mitarbeiter, e.id);
    await actions.time.deleteTime(mitarbeiter, e.id);
    expect(await repos.times.findById(e.id)).toBeUndefined();
  });

  it('fremde Eintraege bleiben unabhaengig vom Status gesperrt', async () => {
    const e = await actions.time.bookTime(mitarbeiter, { orderId: 'o1', datum: '2026-07-01', dauer: 1 });
    await expectDomainError(() => actions.time.deleteTime(anderer, e.id), 'forbidden');
    await actions.time.releaseTime(mitarbeiter, e.id);
    await expectDomainError(() => actions.time.deleteTime(anderer, e.id), 'forbidden');
    await expectDomainError(() => actions.time.deleteTime(partner, e.id), 'forbidden');
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

  it('Mitarbeiter kann eine Review NICHT zurueckgeben (nur der Partner)', async () => {
    const review = await actions.notes.createNote(partner, { orderId: 'o1', text: 'Review' });
    await actions.notes.markDone(mitarbeiter, review.id);
    await expectDomainError(() => actions.notes.reopen(mitarbeiter, review.id), 'forbidden');
  });

  it('Partner gibt eine erledigte Review zurueck an den Mitarbeiter (erledigt -> offen)', async () => {
    const review = await actions.notes.createNote(partner, { orderId: 'o1', text: 'Review' });
    await actions.notes.markDone(mitarbeiter, review.id);
    expect((await actions.notes.reopen(partner, review.id)).noteState).toBe('offen');
  });

  it('Partner nimmt eine freigegebene Review wieder auf (freigegeben -> offen)', async () => {
    const review = await actions.notes.createNote(partner, { orderId: 'o1', text: 'Review' });
    await actions.notes.markDone(mitarbeiter, review.id);
    await actions.notes.approve(partner, review.id);
    expect((await actions.notes.reopen(partner, review.id)).noteState).toBe('offen');
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
    expect(await repos.notes.listComments(frage.id)).toHaveLength(1);
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
    const hist = await actions.status.history(mitarbeiter, 'o1');
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ fromStatus: undefined, toStatus: 'bb', actorId: 'u-wolf' });
  });

  it('weist unbekannten Status ab', async () => {
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o1', 'xx'), 'invalid');
  });

  it('reine Positionsverschiebung erzeugt keinen Historien-Eintrag', async () => {
    await actions.status.setStatus(mitarbeiter, 'o1', 'bb', 1);
    await actions.status.setStatus(mitarbeiter, 'o1', 'bb', 2);
    expect(await actions.status.history(mitarbeiter, 'o1')).toHaveLength(1);
    expect((await repos.overlays.get('o1'))?.boardPosition).toBe(2);
  });

  it('"Erledigt" ist gesperrt, solange die Checkliste offen ist', async () => {
    await repos.checklists.insertMany([
      { id: 'c1', orderId: 'o1', label: 'ELSTER', done: false, position: 1, herkunft: 'vorlage' },
    ]);
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o1', 'er'), 'conflict');
    await repos.checklists.setDone('c1', true);
    const overlay = await actions.status.setStatus(mitarbeiter, 'o1', 'er');
    expect(overlay.boardStatus).toBe('er');
  });

  it('Ordertype ohne Vorlage: leere Checkliste blockiert "Erledigt" nicht (202 Lohn)', async () => {
    const overlay = await actions.status.setStatus(mitarbeiter, 'o1', 'er');
    expect(overlay.boardStatus).toBe('er');
  });

  it('Ordertype mit Vorlage: "Erledigt" vor dem ersten Oeffnen seedet die Vorlage und blockt (Codex P2)', async () => {
    // o2 (301 Jahresabschluss) wurde nie geoeffnet — Checkliste ist leer. Der direkte Sprung auf
    // "er" (Board-Drag/API) darf das Gate NICHT umgehen: Vorlage wird geseedet, Wechsel abgelehnt.
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o2', 'er'), 'conflict');
    const items = await repos.checklists.listByOrder('o2');
    expect(items.length).toBe(3); // JA-Vorlage instanziiert
    expect(items.every((i) => !i.done)).toBe(true);
  });

  it('Ordertype mit Vorlage: nach Abhaken aller geseedeten Punkte ist "Erledigt" moeglich', async () => {
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o2', 'er'), 'conflict');
    for (const i of await repos.checklists.listByOrder('o2')) await repos.checklists.setDone(i.id, true);
    const overlay = await actions.status.setStatus(mitarbeiter, 'o2', 'er');
    expect(overlay.boardStatus).toBe('er');
  });

  it('Gate-Seed ist idempotent: bestehende Client-Checkliste wird nicht ueberschrieben', async () => {
    // Erst per Client-ensure mit eigenen (admin-editierten) Labels instanziieren …
    await actions.checklist.ensure(mitarbeiter, 'o2', ['Einziger Punkt']);
    // … dann "er" versuchen: das Gate darf KEINE Default-Vorlage dazuseeden.
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o2', 'er'), 'conflict');
    const items = await repos.checklists.listByOrder('o2');
    expect(items.map((i) => i.label)).toEqual(['Einziger Punkt']);
  });
});

describe('Auftrags-Sichtbarkeit (IDOR-Schutz, Review-Befunde 1-5)', () => {
  it('blockt Zugriff eines nicht zugewiesenen Nutzers auf fremden Auftrag (not_found)', async () => {
    // 'anderer' (u-klein) ist bei 'o1' weder Bearbeiter noch Partner -> darf nichts.
    await expectDomainError(() => actions.time.bookTime(anderer, { orderId: 'o1', datum: '2026-07-01', dauer: 1 }), 'not_found');
    await expectDomainError(() => actions.status.setStatus(anderer, 'o1', 'bb'), 'not_found');
    await expectDomainError(() => actions.status.history(anderer, 'o1'), 'not_found');
    await expectDomainError(() => actions.notes.createNote(anderer, { orderId: 'o1', text: 'x' }), 'not_found');
  });

  it('blockt auch unbekannte Auftrags-IDs (kein Enumerations-Orakel)', async () => {
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'gibtsnicht', 'bb'), 'not_found');
    await expectDomainError(() => actions.notes.createNote(mitarbeiter, { orderId: 'gibtsnicht', text: 'x' }), 'not_found');
  });

  it('verhindert Mutation einer Note ueber ihre ID, wenn der Auftrag nicht sichtbar ist', async () => {
    // Mitarbeiter legt auf seinem Auftrag eine Frage an; 'anderer' kennt die ID, darf aber nicht ran.
    const frage = await actions.notes.createNote(mitarbeiter, { orderId: 'o1', text: 'x' });
    await expectDomainError(() => actions.notes.markDone(anderer, frage.id), 'not_found');
    await expectDomainError(() => actions.notes.comment(anderer, frage.id, 'hi'), 'not_found');
    await expectDomainError(() => actions.notes.deleteNote(anderer, frage.id), 'not_found');
  });
});

describe('Checklisten-Aktionen', () => {
  it('seedet die Checkliste einmalig aus Vorlagen-Labels (idempotent)', async () => {
    const items = await actions.checklist.ensure(mitarbeiter, 'o1', ['  A  ', '', 'B']);
    expect(items.map((i) => i.label)).toEqual(['A', 'B']); // getrimmt, leere raus
    expect(items.map((i) => i.position)).toEqual([0, 1]);
    // Zweiter Aufruf mit anderen Labels aendert nichts (existiert bereits).
    const again = await actions.checklist.ensure(mitarbeiter, 'o1', ['C', 'D', 'E']);
    expect(again).toHaveLength(2);
    expect(await repos.checklists.listByOrder('o1')).toHaveLength(2);
  });

  it('seedet nur fuer sichtbare Auftraege', async () => {
    await expectDomainError(() => actions.checklist.ensure(anderer, 'o1', ['A']), 'not_found');
  });

  it('legt einen Punkt an (offen, aufsteigende Position) und listet ihn', async () => {
    const a = await actions.checklist.add(mitarbeiter, 'o1', '  Beleg pruefen  ');
    expect(a).toMatchObject({ orderId: 'o1', label: 'Beleg pruefen', done: false, position: 0 });
    const b = await actions.checklist.add(mitarbeiter, 'o1', 'ELSTER');
    expect(b.position).toBe(1);
    expect(await repos.checklists.listByOrder('o1')).toHaveLength(2);
  });

  it('lehnt einen leeren Punkt ab', async () => {
    await expectDomainError(() => actions.checklist.add(mitarbeiter, 'o1', '   '), 'invalid');
  });

  it('hakt einen Punkt ab und wieder ab (idempotent)', async () => {
    const item = await actions.checklist.add(mitarbeiter, 'o1', 'Beleg');
    expect((await actions.checklist.setDone(mitarbeiter, 'o1', item.id, true)).done).toBe(true);
    // erneut auf denselben Wert -> idempotent, kein Fehler
    expect((await actions.checklist.setDone(mitarbeiter, 'o1', item.id, true)).done).toBe(true);
    expect((await actions.checklist.setDone(mitarbeiter, 'o1', item.id, false)).done).toBe(false);
  });

  it('entfernt einen manuellen Punkt als Soft-Delete (revisionssicher, Review P1.3)', async () => {
    const item = await actions.checklist.add(mitarbeiter, 'o1', 'Beleg');
    expect(item.herkunft).toBe('manuell');
    await actions.checklist.remove(mitarbeiter, 'o1', item.id);
    // aus der aktiven Liste verschwunden …
    expect(await repos.checklists.listByOrder('o1')).toHaveLength(0);
    // … aber mit Inhalt, Loeschendem und Zeitpunkt erhalten (Server setzt Wer/Wann).
    const geloescht = await repos.checklists.listDeletedByOrder('o1');
    expect(geloescht).toHaveLength(1);
    expect(geloescht[0]).toMatchObject({ label: 'Beleg', deletedBy: 'u-wolf' });
    expect(geloescht[0].deletedAt).toBeTruthy();
    // erneutes Loeschen ist idempotent (kein Fehler, kein zweiter Stempel)
    await actions.checklist.remove(mitarbeiter, 'o1', item.id);
    expect((await repos.checklists.listDeletedByOrder('o1'))[0].deletedBy).toBe('u-wolf');
  });

  it('Pflichtpunkte aus der Vorlage sind NIE loeschbar (Review P1.2)', async () => {
    const items = await actions.checklist.ensure(mitarbeiter, 'o1', ['Pflicht A']);
    expect(items[0].herkunft).toBe('vorlage');
    await expectDomainError(() => actions.checklist.remove(mitarbeiter, 'o1', items[0].id), 'conflict');
    expect(await repos.checklists.listByOrder('o1')).toHaveLength(1);
  });

  it('das "Erledigt"-Gate ist nicht durch Loeschen offener Pflichtpunkte umgehbar', async () => {
    // o2 (301) traegt die Default-Vorlage: Gate-Versuch seedet Pflichtpunkte.
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o2', 'er'), 'conflict');
    const pflicht = await repos.checklists.listByOrder('o2');
    // Loesch-Versuche prallen ab -> Gate bleibt zu.
    for (const p of pflicht) {
      await expectDomainError(() => actions.checklist.remove(mitarbeiter, 'o2', p.id), 'conflict');
    }
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o2', 'er'), 'conflict');
  });

  it('geloeschte manuelle Punkte beeinflussen das "Erledigt"-Gate nicht', async () => {
    // o1 (202 Lohn, keine Vorlage): ein offener manueller Punkt blockt, sein Soft-Delete gibt frei.
    const item = await actions.checklist.add(mitarbeiter, 'o1', 'Zusatzpunkt');
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o1', 'er'), 'conflict');
    await actions.checklist.remove(mitarbeiter, 'o1', item.id);
    expect((await actions.status.setStatus(mitarbeiter, 'o1', 'er')).boardStatus).toBe('er');
  });

  it('schaltet das "Erledigt"-Gate ueber add + setDone (integrativ)', async () => {
    const item = await actions.checklist.add(mitarbeiter, 'o1', 'Beleg');
    await expectDomainError(() => actions.status.setStatus(mitarbeiter, 'o1', 'er'), 'conflict');
    await actions.checklist.setDone(mitarbeiter, 'o1', item.id, true);
    expect((await actions.status.setStatus(mitarbeiter, 'o1', 'er')).boardStatus).toBe('er');
  });

  it('blockt Checklisten-Zugriff auf fremden Auftrag (not_found)', async () => {
    const item = await actions.checklist.add(mitarbeiter, 'o1', 'Beleg');
    await expectDomainError(() => actions.checklist.add(anderer, 'o1', 'x'), 'not_found');
    await expectDomainError(() => actions.checklist.setDone(anderer, 'o1', item.id, true), 'not_found');
    await expectDomainError(() => actions.checklist.remove(anderer, 'o1', item.id), 'not_found');
  });

  it('meldet not_found fuer einen unbekannten Punkt auf einem sichtbaren Auftrag', async () => {
    await expectDomainError(() => actions.checklist.setDone(mitarbeiter, 'o1', 'gibtsnicht', true), 'not_found');
    await expectDomainError(() => actions.checklist.remove(mitarbeiter, 'o1', 'gibtsnicht'), 'not_found');
  });
});
