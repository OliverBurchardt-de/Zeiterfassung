import type { ConnectionPool } from 'mssql';
import { sql } from './db';
import type { TimeEntry, TimeStatus, Aufwandsart } from '../../domain/types';
import type { TimeEntryRepository } from '../../domain/ports';
import { isoDate, isoDateTime, optionalString } from './rows';

/** DB-Zeile (dbo.time_entries) -> Domaenen-TimeEntry. Reine Funktion (testbar ohne DB). */
export function mapTimeEntryRow(row: Record<string, unknown>): TimeEntry {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    orderId: String(row.order_id),
    suborderId: optionalString(row.suborder_id),
    datum: isoDate(row.work_date),
    dauer: Number(row.hours),
    notiz: optionalString(row.note),
    status: (row.status === 'freigegeben' || row.status === 'uebertragen' ? row.status : 'erfasst') as TimeStatus,
    aufwandsart:
      row.aufwandsart === 'mehraufwand' || row.aufwandsart === 'dumm' ? (row.aufwandsart as Aufwandsart) : undefined,
    costPosition: optionalString(row.cost_position),
    datevPostingId: optionalString(row.datev_posting_id),
    idempotencyKey: String(row.idempotency_key),
    createdAt: isoDateTime(row.created_at),
  };
}

const COLS =
  'id, user_id, order_id, suborder_id, work_date, hours, note, status, aufwandsart, cost_position, datev_posting_id, idempotency_key, created_at';
// Neueste zuerst (wie "Meine Zeiten") — identisch zur Memory-Sortierung.
const ORDER = 'ORDER BY work_date DESC, created_at DESC';

/** Bindet die veraenderlichen Fachfelder eines Eintrags an ein Request (INSERT + UPDATE teilen sie). */
function bindFachfelder(req: sql.Request, e: TimeEntry): sql.Request {
  return req
    .input('suborder_id', sql.NVarChar(64), e.suborderId ?? null)
    // ISO-"JJJJ-MM-TT" als Text uebergeben — die implizite Konvertierung nach DATE ist
    // fuer dieses Format eindeutig (keine Zeitzonen-/Sprachabhaengigkeit).
    .input('work_date', sql.VarChar(10), e.datum)
    .input('hours', sql.Decimal(9, 2), e.dauer)
    .input('note', sql.NVarChar(sql.MAX), e.notiz ?? null)
    .input('status', sql.NVarChar(20), e.status)
    .input('aufwandsart', sql.NVarChar(20), e.aufwandsart ?? null)
    .input('cost_position', sql.NVarChar(20), e.costPosition ?? null)
    .input('datev_posting_id', sql.NVarChar(64), e.datevPostingId ?? null);
}

export function createMssqlTimeEntryRepository(pool: ConnectionPool): TimeEntryRepository {
  return {
    async insert(e) {
      await bindFachfelder(pool.request(), e)
        .input('id', sql.NVarChar(64), e.id)
        .input('user_id', sql.NVarChar(64), e.userId)
        .input('order_id', sql.NVarChar(64), e.orderId)
        .input('idempotency_key', sql.NVarChar(100), e.idempotencyKey)
        .input('created_at', sql.DateTime2, new Date(e.createdAt))
        .query(
          `INSERT INTO dbo.time_entries (${COLS})
           VALUES (@id, @user_id, @order_id, @suborder_id, @work_date, @hours, @note, @status,
                   @aufwandsart, @cost_position, @datev_posting_id, @idempotency_key, @created_at)`
        );
    },
    async insertWithinDailyLimit(e, maxStunden) {
      // Pruefung + Insert in EINER Transaktion (Review P1-4). SERIALIZABLE + UPDLOCK/HOLDLOCK auf
      // die Summenabfrage: parallele Buchungen desselben Nutzers/Tages werden serialisiert, koennen
      // also nicht gemeinsam ueber die Grenze einfuegen.
      const tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      try {
        const r = await new sql.Request(tx)
          .input('user_id', sql.NVarChar(64), e.userId)
          .input('work_date', sql.VarChar(10), e.datum)
          .query(
            `SELECT COALESCE(SUM(hours), 0) AS summe FROM dbo.time_entries WITH (UPDLOCK, HOLDLOCK)
             WHERE user_id = @user_id AND work_date = @work_date`
          );
        const bereits = Number(r.recordset[0]?.summe ?? 0);
        const summe = Math.round((bereits + e.dauer) * 100) / 100;
        if (summe > maxStunden) {
          await tx.rollback();
          return { ok: false, bereits };
        }
        await bindFachfelder(new sql.Request(tx), e)
          .input('id', sql.NVarChar(64), e.id)
          .input('user_id', sql.NVarChar(64), e.userId)
          .input('order_id', sql.NVarChar(64), e.orderId)
          .input('idempotency_key', sql.NVarChar(100), e.idempotencyKey)
          .input('created_at', sql.DateTime2, new Date(e.createdAt))
          .query(
            `INSERT INTO dbo.time_entries (${COLS})
             VALUES (@id, @user_id, @order_id, @suborder_id, @work_date, @hours, @note, @status,
                     @aufwandsart, @cost_position, @datev_posting_id, @idempotency_key, @created_at)`
          );
        await tx.commit();
        return { ok: true };
      } catch (err) {
        // Doppelter Idempotenz-Schluessel (Unique-Index) o. Ae. — Transaktion zurueckrollen und
        // den Fehler durchreichen; die Domaenen-Aktion loest den Parallelfall auf.
        try {
          await tx.rollback();
        } catch {
          /* bereits beendet */
        }
        throw err;
      }
    },
    async findById(id) {
      const r = await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .query(`SELECT ${COLS} FROM dbo.time_entries WHERE id = @id`);
      return r.recordset[0] ? mapTimeEntryRow(r.recordset[0]) : undefined;
    },
    async findByIdempotencyKey(key) {
      const r = await pool
        .request()
        .input('key', sql.NVarChar(100), key)
        .query(`SELECT ${COLS} FROM dbo.time_entries WHERE idempotency_key = @key`);
      return r.recordset[0] ? mapTimeEntryRow(r.recordset[0]) : undefined;
    },
    async listByOrder(orderId) {
      const r = await pool
        .request()
        .input('order_id', sql.NVarChar(64), orderId)
        .query(`SELECT ${COLS} FROM dbo.time_entries WHERE order_id = @order_id ${ORDER}`);
      return r.recordset.map(mapTimeEntryRow);
    },
    async sumByUserAndDate(userId, datum) {
      const r = await pool
        .request()
        .input('user_id', sql.NVarChar(64), userId)
        .input('work_date', sql.VarChar(10), datum)
        .query(
          'SELECT COALESCE(SUM(hours), 0) AS summe FROM dbo.time_entries WHERE user_id = @user_id AND work_date = @work_date'
        );
      return Number(r.recordset[0]?.summe ?? 0);
    },
    async update(e) {
      await bindFachfelder(pool.request(), e)
        .input('id', sql.NVarChar(64), e.id)
        .query(
          `UPDATE dbo.time_entries
           SET suborder_id = @suborder_id, work_date = @work_date, hours = @hours, note = @note,
               status = @status, aufwandsart = @aufwandsart, cost_position = @cost_position,
               datev_posting_id = @datev_posting_id
           WHERE id = @id`
        );
    },
    async remove(id) {
      await pool.request().input('id', sql.NVarChar(64), id).query('DELETE FROM dbo.time_entries WHERE id = @id');
    },
  };
}
