import { describe, expect, it } from 'vitest';
import { isoDate, isoDateTime, optionalIsoDateTime, optionalNumber, optionalString, bit } from './rows';
import { mapTimeEntryRow } from './times';
import { mapNoteRow, mapNoteCommentRow } from './notes';
import { mapOverlayRow } from './overlays';
import { mapChecklistItemRow } from './checklists';
import { mapStatusChangeRow } from './statusHistory';
import { mapOutboxRow } from './outbox';
import { mapAnforderungRow } from './anforderungen';
import { mapBesonderheitRow } from './besonderheiten';

// Reine Zeilen-Mapper — testbar ohne Datenbank (wie mapUserRow in users.test.ts).

describe('rows-Helfer', () => {
  it('wandelt DATE/DATETIME2 (JS-Date, UTC) in ISO-Strings', () => {
    expect(isoDate(new Date('2026-07-03T00:00:00.000Z'))).toBe('2026-07-03');
    expect(isoDate('2026-07-03')).toBe('2026-07-03');
    expect(isoDateTime(new Date('2026-07-03T09:30:00.000Z'))).toBe('2026-07-03T09:30:00.000Z');
    expect(optionalIsoDateTime(null)).toBeUndefined();
    expect(optionalIsoDateTime(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00:00:00.000Z');
  });

  it('behandelt NULL-Spalten und BIT-Varianten', () => {
    expect(optionalString(null)).toBeUndefined();
    expect(optionalString('x')).toBe('x');
    expect(optionalNumber(null)).toBeUndefined();
    expect(optionalNumber(3)).toBe(3);
    expect(bit(true)).toBe(true);
    expect(bit(1)).toBe(true);
    expect(bit(0)).toBe(false);
    expect(bit(null)).toBe(false);
  });
});

describe('mapTimeEntryRow', () => {
  it('mappt eine volle Zeile inkl. DATE als JS-Date', () => {
    const e = mapTimeEntryRow({
      id: 't1',
      user_id: 'u1',
      order_id: 'o1',
      suborder_id: 's1',
      work_date: new Date('2026-07-01T00:00:00.000Z'),
      hours: 1.75,
      note: 'Abstimmung',
      status: 'freigegeben',
      aufwandsart: 'mehraufwand',
      cost_position: '4',
      datev_posting_id: '9001',
      idempotency_key: 'k-1',
      created_at: new Date('2026-07-01T10:00:00.000Z'),
    });
    expect(e).toEqual({
      id: 't1',
      userId: 'u1',
      orderId: 'o1',
      suborderId: 's1',
      datum: '2026-07-01',
      dauer: 1.75,
      notiz: 'Abstimmung',
      status: 'freigegeben',
      aufwandsart: 'mehraufwand',
      costPosition: '4',
      datevPostingId: '9001',
      idempotencyKey: 'k-1',
      createdAt: '2026-07-01T10:00:00.000Z',
    });
  });

  it('laesst NULL-Felder weg und faellt bei unbekanntem Status auf "erfasst" zurueck', () => {
    const e = mapTimeEntryRow({
      id: 't2',
      user_id: 'u1',
      order_id: 'o1',
      suborder_id: null,
      work_date: new Date('2026-07-02T00:00:00.000Z'),
      hours: 0.25,
      note: null,
      status: 'kaputt',
      aufwandsart: null,
      cost_position: null,
      datev_posting_id: null,
      idempotency_key: 'k-2',
      created_at: new Date('2026-07-02T08:00:00.000Z'),
    });
    expect(e.status).toBe('erfasst');
    expect(e.suborderId).toBeUndefined();
    expect(e.notiz).toBeUndefined();
    expect(e.aufwandsart).toBeUndefined();
    expect(e.datevPostingId).toBeUndefined();
  });
});

describe('Noten-/Auftrags-Mapper', () => {
  it('mappt Note und Kommentar', () => {
    const n = mapNoteRow({
      id: 'n1',
      order_id: 'o1',
      kind: 'review',
      note_state: 'erledigt',
      text: 'Bitte pruefen',
      author_id: 'u2',
      created_at: new Date('2026-07-01T12:00:00.000Z'),
    });
    expect(n.kind).toBe('review');
    expect(n.noteState).toBe('erledigt');
    const c = mapNoteCommentRow({
      id: 'c1',
      note_id: 'n1',
      author_id: 'u1',
      text: 'Rueckfrage',
      created_at: new Date('2026-07-01T13:00:00.000Z'),
    });
    expect(c).toMatchObject({ id: 'c1', noteId: 'n1', authorId: 'u1', text: 'Rueckfrage' });
  });

  it('faellt bei unbekanntem kind/note_state auf frage/offen zurueck', () => {
    const n = mapNoteRow({ id: 'n2', order_id: 'o1', kind: 'x', note_state: 'y', text: 't', author_id: 'u1', created_at: 'z' });
    expect(n.kind).toBe('frage');
    expect(n.noteState).toBe('offen');
  });

  it('mappt Overlay, Checklist-Item und Statuswechsel', () => {
    expect(
      mapOverlayRow({ order_id: 'o1', board_status: 'bb', board_position: 2, umplanungen_verbraucht: 1 })
    ).toEqual({ orderId: 'o1', boardStatus: 'bb', boardPosition: 2, umplanungenVerbraucht: 1 });
    expect(mapOverlayRow({ order_id: 'o2', board_status: null, board_position: null, umplanungen_verbraucht: 0 })).toEqual({
      orderId: 'o2',
      boardStatus: undefined,
      boardPosition: undefined,
      umplanungenVerbraucht: 0,
    });
    expect(mapChecklistItemRow({ id: 'c1', order_id: 'o1', label: 'ELSTER', done: 1, position: 3 })).toEqual({
      id: 'c1',
      orderId: 'o1',
      label: 'ELSTER',
      done: true,
      position: 3,
    });
    const s = mapStatusChangeRow({
      id: 's1',
      order_id: 'o1',
      from_status: null,
      to_status: 'bb',
      actor_id: 'u1',
      created_at: new Date('2026-07-01T09:00:00.000Z'),
    });
    expect(s.fromStatus).toBeUndefined();
    expect(s.toStatus).toBe('bb');
  });
});

describe('Outbox-/Verwaltungs-Mapper', () => {
  it('mappt einen Outbox-Eintrag mit Status-Rueckfall auf "offen"', () => {
    const e = mapOutboxRow({
      id: 'x1',
      kind: 'expense-posting',
      payload: '{"a":1}',
      idempotency_key: 'k1',
      status: 'irgendwas',
      attempts: 2,
      last_error: 'HTTP 500',
      created_at: new Date('2026-07-01T09:00:00.000Z'),
      processed_at: null,
    });
    expect(e.status).toBe('offen');
    expect(e.attempts).toBe(2);
    expect(e.lastError).toBe('HTTP 500');
    expect(e.processedAt).toBeUndefined();
  });

  it('mappt Anforderung und Besonderheit', () => {
    const a = mapAnforderungRow({
      id: 'a1',
      mandant: 'Muster GmbH',
      mandant_nr: '10001',
      ordertype: 'JAP',
      vj: 2025,
      zeitraum: null,
      notiz: 'bitte anlegen',
      erstellt_von: 'S. Wolf',
      erstellt_von_id: 'u-wolf',
      status: 'abgelehnt',
      grund: 'doppelt',
      created_at: new Date('2026-07-01T09:00:00.000Z'),
      erledigt_am: new Date('2026-07-02T09:00:00.000Z'),
    });
    expect(a.status).toBe('abgelehnt');
    expect(a.zeitraum).toBeUndefined();
    expect(a.erledigtAm).toBe('2026-07-02T09:00:00.000Z');
    const b = mapBesonderheitRow({
      id: 'b1',
      client_id: '10001',
      ordertype: '106',
      text: 'OPOS-Liste gesondert',
      author: 'O. Burchardt',
      created_at: new Date('2026-06-01T09:00:00.000Z'),
      updated_at: new Date('2026-06-02T09:00:00.000Z'),
    });
    expect(b).toMatchObject({ clientId: '10001', ordertype: '106', updatedAt: '2026-06-02T09:00:00.000Z' });
  });
});
