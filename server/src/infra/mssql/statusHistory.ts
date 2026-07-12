import type { ConnectionPool, Request } from 'mssql';
import { sql } from './db';
import type { StatusChange } from '../../domain/types';
import type { StatusHistoryRepository } from '../../domain/ports';
import { isoDateTime, optionalString } from './rows';

/** DB-Zeile (dbo.status_history) -> Domaenen-StatusChange. Reine Funktion (testbar ohne DB). */
export function mapStatusChangeRow(row: Record<string, unknown>): StatusChange {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    fromStatus: optionalString(row.from_status),
    toStatus: String(row.to_status),
    actorId: String(row.actor_id),
    createdAt: isoDateTime(row.created_at),
  };
}

const COLS = 'id, order_id, from_status, to_status, actor_id, created_at';

/**
 * Insert als eigenstaendiges Statement — Pool (Repo) oder laufende Transaktion
 * (StatusWechselTransaktion, Review P2.6); den Request stellt der Aufrufer.
 */
export async function insertStatusChangeStatement(request: Request, c: StatusChange): Promise<void> {
  await request
    .input('id', sql.NVarChar(64), c.id)
    .input('order_id', sql.NVarChar(64), c.orderId)
    .input('from_status', sql.NVarChar(4), c.fromStatus ?? null)
    .input('to_status', sql.NVarChar(4), c.toStatus)
    .input('actor_id', sql.NVarChar(64), c.actorId)
    .input('created_at', sql.DateTime2, new Date(c.createdAt))
    .query(
      `INSERT INTO dbo.status_history (${COLS})
       VALUES (@id, @order_id, @from_status, @to_status, @actor_id, @created_at)`
    );
}

export function createMssqlStatusHistoryRepository(pool: ConnectionPool): StatusHistoryRepository {
  return {
    async insert(c) {
      await insertStatusChangeStatement(pool.request(), c);
    },
    async listByOrder(orderId) {
      const r = await pool
        .request()
        .input('order_id', sql.NVarChar(64), orderId)
        .query(`SELECT ${COLS} FROM dbo.status_history WHERE order_id = @order_id ORDER BY created_at`);
      return r.recordset.map(mapStatusChangeRow);
    },
  };
}
