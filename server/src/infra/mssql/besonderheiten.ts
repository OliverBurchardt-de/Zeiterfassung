import type { ConnectionPool } from 'mssql';
import { sql } from './db';
import type { Besonderheit } from '../../domain/types';
import type { BesonderheitRepository } from '../../domain/ports';
import { isoDateTime } from './rows';

/** DB-Zeile (dbo.besonderheiten) -> Domaenen-Besonderheit. Reine Funktion (testbar ohne DB). */
export function mapBesonderheitRow(row: Record<string, unknown>): Besonderheit {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    ordertype: String(row.ordertype),
    text: String(row.text),
    author: String(row.author),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
  };
}

const COLS = 'id, client_id, ordertype, text, author, created_at, updated_at';

export function createMssqlBesonderheitRepository(pool: ConnectionPool): BesonderheitRepository {
  return {
    async listByKey(clientId, ordertype) {
      const r = await pool
        .request()
        .input('client_id', sql.NVarChar(64), clientId)
        .input('ordertype', sql.NVarChar(20), ordertype)
        .query(
          `SELECT ${COLS} FROM dbo.besonderheiten
           WHERE client_id = @client_id AND ordertype = @ordertype ORDER BY created_at`
        );
      return r.recordset.map(mapBesonderheitRow);
    },
    async insert(b) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), b.id)
        .input('client_id', sql.NVarChar(64), b.clientId)
        .input('ordertype', sql.NVarChar(20), b.ordertype)
        .input('text', sql.NVarChar(sql.MAX), b.text)
        .input('author', sql.NVarChar(200), b.author)
        .input('created_at', sql.DateTime2, new Date(b.createdAt))
        .input('updated_at', sql.DateTime2, new Date(b.updatedAt))
        .query(
          `INSERT INTO dbo.besonderheiten (${COLS})
           VALUES (@id, @client_id, @ordertype, @text, @author, @created_at, @updated_at)`
        );
    },
    async updateText(id, text) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .input('text', sql.NVarChar(sql.MAX), text)
        .query('UPDATE dbo.besonderheiten SET text = @text, updated_at = SYSUTCDATETIME() WHERE id = @id');
    },
    async remove(id) {
      await pool.request().input('id', sql.NVarChar(64), id).query('DELETE FROM dbo.besonderheiten WHERE id = @id');
    },
  };
}
