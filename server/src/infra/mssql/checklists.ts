import type { ConnectionPool } from 'mssql';
import { sql } from './db';
import type { ChecklistItem } from '../../domain/types';
import type { ChecklistRepository } from '../../domain/ports';
import { bit } from './rows';

/** DB-Zeile (dbo.checklist_items) -> Domaenen-ChecklistItem. Reine Funktion (testbar ohne DB). */
export function mapChecklistItemRow(row: Record<string, unknown>): ChecklistItem {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    label: String(row.label),
    done: bit(row.done),
    position: Number(row.position ?? 0),
  };
}

const COLS = 'id, order_id, label, done, position';

export function createMssqlChecklistRepository(pool: ConnectionPool): ChecklistRepository {
  return {
    async listByOrder(orderId) {
      const r = await pool
        .request()
        .input('order_id', sql.NVarChar(64), orderId)
        .query(`SELECT ${COLS} FROM dbo.checklist_items WHERE order_id = @order_id ORDER BY position`);
      return r.recordset.map(mapChecklistItemRow);
    },
    async insertMany(items) {
      // Checklisten sind kurz (Vorlagen-Instanziierung) — sequenzielle Inserts genuegen.
      for (const item of items) {
        await pool
          .request()
          .input('id', sql.NVarChar(64), item.id)
          .input('order_id', sql.NVarChar(64), item.orderId)
          .input('label', sql.NVarChar(500), item.label)
          .input('done', sql.Bit, item.done)
          .input('position', sql.Int, item.position)
          .query(`INSERT INTO dbo.checklist_items (${COLS}) VALUES (@id, @order_id, @label, @done, @position)`);
      }
    },
    async setDone(id, done) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .input('done', sql.Bit, done)
        .query('UPDATE dbo.checklist_items SET done = @done WHERE id = @id');
    },
  };
}
