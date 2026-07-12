import { describe, expect, it } from 'vitest';
import type { TimeEntry, Note, NoteComment, OutboxEntry } from '../../domain/types';
import {
  createMemoryTimeEntryRepository,
  createMemoryNoteRepository,
  createMemoryOverlayRepository,
  createMemoryChecklistRepository,
  createMemoryOutboxRepository,
  createMemoryAnforderungRepository,
  createMemoryBesonderheitRepository,
} from './repos';

// Verhaltenstests der Memory-Repos — dieselben Ports erfuellt spaeter MS SQL; die
// Domaenen-Aktionen (naechster Schritt) laufen in Tests gegen genau diese Implementierung.

function zeit(id: string, over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id,
    userId: 'u1',
    orderId: 'o1',
    datum: '2026-07-01',
    dauer: 1,
    status: 'erfasst',
    idempotencyKey: `k-${id}`,
    createdAt: '2026-07-01T08:00:00.000Z',
    ...over,
  };
}

describe('Memory-TimeEntryRepository', () => {
  it('sortiert neueste zuerst und findet per Idempotenz-Schluessel', async () => {
    const repo = createMemoryTimeEntryRepository();
    await repo.insert(zeit('t1', { datum: '2026-07-01' }));
    await repo.insert(zeit('t2', { datum: '2026-07-02' }));
    const list = await repo.listByOrder('o1');
    expect(list.map((e) => e.id)).toEqual(['t2', 't1']);
    expect((await repo.findByIdempotencyKey('k-t1'))?.id).toBe('t1');
    expect(await repo.findByIdempotencyKey('fremd')).toBeUndefined();
  });

  it('aktualisiert und loescht', async () => {
    const repo = createMemoryTimeEntryRepository();
    await repo.insert(zeit('t1'));
    await repo.update({ ...zeit('t1'), status: 'freigegeben', dauer: 2.5 });
    expect(await repo.findById('t1')).toMatchObject({ status: 'freigegeben', dauer: 2.5 });
    await repo.remove('t1');
    expect(await repo.findById('t1')).toBeUndefined();
  });
});

describe('Memory-NoteRepository', () => {
  const note = (id: string): Note => ({
    id,
    orderId: 'o1',
    kind: 'frage',
    noteState: 'offen',
    text: 'Frage',
    authorId: 'u1',
    createdAt: `2026-07-0${id.length}T08:00:00.000Z`,
  });
  const kommentar = (id: string, noteId: string): NoteComment => ({
    id,
    noteId,
    authorId: 'u2',
    text: 'Antwort',
    createdAt: '2026-07-01T09:00:00.000Z',
  });

  it('loescht Kommentare mit der Note (Kaskade wie in SQL)', async () => {
    const repo = createMemoryNoteRepository();
    await repo.insert(note('n1'));
    await repo.insertComment(kommentar('c1', 'n1'));
    await repo.insertComment(kommentar('c2', 'n1'));
    expect(await repo.listComments('n1')).toHaveLength(2);
    await repo.remove('n1');
    expect(await repo.listByOrder('o1')).toHaveLength(0);
    expect(await repo.listComments('n1')).toHaveLength(0);
  });
});

describe('Memory-Overlay/Checklist', () => {
  it('upsert legt an und ueberschreibt', async () => {
    const repo = createMemoryOverlayRepository();
    await repo.upsert({ orderId: 'o1', boardStatus: 'av', umplanungenVerbraucht: 0 });
    await repo.upsert({ orderId: 'o1', boardStatus: 'bb', boardPosition: 1, umplanungenVerbraucht: 1 });
    expect(await repo.list()).toHaveLength(1);
    expect(await repo.get('o1')).toMatchObject({ boardStatus: 'bb', umplanungenVerbraucht: 1 });
  });

  it('checkliste: sortiert nach Position, hakt ab', async () => {
    const repo = createMemoryChecklistRepository();
    await repo.insertMany([
      { id: 'c2', orderId: 'o1', label: 'B', done: false, position: 2, herkunft: 'vorlage' },
      { id: 'c1', orderId: 'o1', label: 'A', done: false, position: 1, herkunft: 'manuell' },
    ]);
    await repo.setDone('c1', true);
    const list = await repo.listByOrder('o1');
    expect(list.map((i) => i.id)).toEqual(['c1', 'c2']);
    expect(list[0].done).toBe(true);
  });

  it('checkliste: Soft-Delete nimmt aus der aktiven Liste, bleibt aber mit Wer/Wann erhalten', async () => {
    const repo = createMemoryChecklistRepository();
    await repo.insertMany([
      { id: 'c1', orderId: 'o1', label: 'A', done: false, position: 1, herkunft: 'manuell' },
      { id: 'c2', orderId: 'o1', label: 'B', done: false, position: 2, herkunft: 'vorlage' },
    ]);
    await repo.softDelete('c1', 'u-x', '2026-07-12T10:00:00.000Z');
    expect((await repo.listByOrder('o1')).map((i) => i.id)).toEqual(['c2']);
    const geloescht = await repo.listDeletedByOrder('o1');
    expect(geloescht).toHaveLength(1);
    expect(geloescht[0]).toMatchObject({ id: 'c1', label: 'A', deletedBy: 'u-x', deletedAt: '2026-07-12T10:00:00.000Z' });
    // findById findet den Punkt weiterhin (fuer die Idempotenz-Pruefung der Aktion)
    expect((await repo.findById('c1'))?.deletedAt).toBeTruthy();
  });
});

describe('Memory-OutboxRepository', () => {
  const eintrag = (id: string, createdAt: string): OutboxEntry => ({
    id,
    kind: 'expense-posting',
    payload: '{}',
    idempotencyKey: `k-${id}`,
    status: 'offen',
    attempts: 0,
    createdAt,
  });

  it('liefert aelteste offene zuerst; Fehlversuch bleibt offen, Fehler nicht', async () => {
    const repo = createMemoryOutboxRepository();
    await repo.enqueue(eintrag('x2', '2026-07-02T08:00:00.000Z'));
    await repo.enqueue(eintrag('x1', '2026-07-01T08:00:00.000Z'));
    expect((await repo.nextOpen(1)).map((e) => e.id)).toEqual(['x1']);

    await repo.markFehlversuch('x1', 'HTTP 500');
    let offene = await repo.nextOpen(10);
    expect(offene.map((e) => e.id)).toEqual(['x1', 'x2']);
    expect(offene[0]).toMatchObject({ attempts: 1, lastError: 'HTTP 500' });

    await repo.markFehler('x1', 'endgueltig');
    await repo.markUebertragen('x2');
    offene = await repo.nextOpen(10);
    expect(offene).toHaveLength(0);
  });
});

describe('Memory-Anforderung/Besonderheit', () => {
  it('filtert Anforderungen nach Ersteller und aktualisiert den Ausgang', async () => {
    const repo = createMemoryAnforderungRepository();
    const basis = {
      mandant: 'Muster GmbH',
      mandantNr: '10001',
      ordertype: 'JAP',
      vj: 2025,
      notiz: 'bitte anlegen',
      status: 'angefordert' as const,
    };
    await repo.insert({ ...basis, id: 'a1', erstelltVon: 'S. Wolf', erstelltVonId: 'u-wolf', createdAt: '2026-07-01T08:00:00.000Z' });
    await repo.insert({ ...basis, id: 'a2', erstelltVon: 'M. Klein', erstelltVonId: 'u-klein', createdAt: '2026-07-02T08:00:00.000Z' });
    expect((await repo.list()).map((a) => a.id)).toEqual(['a2', 'a1']);
    expect((await repo.listByErsteller('u-wolf')).map((a) => a.id)).toEqual(['a1']);

    const a1 = await repo.findById('a1');
    await repo.update({ ...a1!, status: 'abgelehnt', grund: 'doppelt', erledigtAm: '2026-07-03T08:00:00.000Z' });
    expect(await repo.findById('a1')).toMatchObject({ status: 'abgelehnt', grund: 'doppelt' });
  });

  it('besonderheiten: Schluessel clientId+ordertype, updateText stempelt updatedAt neu', async () => {
    const repo = createMemoryBesonderheitRepository();
    const basis = { text: 'OPOS gesondert', author: 'O. Burchardt', createdAt: '2026-06-01T08:00:00.000Z', updatedAt: '2026-06-01T08:00:00.000Z' };
    await repo.insert({ ...basis, id: 'b1', clientId: '10001', ordertype: '106' });
    await repo.insert({ ...basis, id: 'b2', clientId: '10001', ordertype: 'JAP' });
    expect((await repo.listByKey('10001', '106')).map((b) => b.id)).toEqual(['b1']);

    await repo.updateText('b1', 'OPOS monatlich');
    const [b1] = await repo.listByKey('10001', '106');
    expect(b1.text).toBe('OPOS monatlich');
    expect(b1.updatedAt > basis.updatedAt).toBe(true);

    await repo.remove('b1');
    expect(await repo.listByKey('10001', '106')).toHaveLength(0);
  });
});
