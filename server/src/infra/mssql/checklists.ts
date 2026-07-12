import type { ConnectionPool } from 'mssql';
import { sql } from './db';
import type { ChecklistItem, ChecklistHerkunft } from '../../domain/types';
import type { ChecklistRepository } from '../../domain/ports';
import { bit, optionalIsoDateTime, optionalString } from './rows';

/** DB-Zeile (dbo.checklist_items) -> Domaenen-ChecklistItem. Reine Funktion (testbar ohne DB). */
export function mapChecklistItemRow(row: Record<string, unknown>): ChecklistItem {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    label: String(row.label),
    done: bit(row.done),
    position: Number(row.position ?? 0),
    // Fail-safe (Review 12.07.2026): Zeilen ohne Herkunft gelten als Pflichtpunkte ('vorlage'),
    // damit eine fehlende Einordnung die Pflichtpruefung nie abschwaecht.
    herkunft: (row.herkunft === 'manuell' ? 'manuell' : 'vorlage') as ChecklistHerkunft,
    deletedAt: optionalIsoDateTime(row.deleted_at),
    deletedBy: optionalString(row.deleted_by),
  };
}

const COLS = 'id, order_id, label, done, position, herkunft, deleted_at, deleted_by';

export function createMssqlChecklistRepository(pool: ConnectionPool): ChecklistRepository {
  return {
    async listByOrder(orderId) {
      const r = await pool
        .request()
        .input('order_id', sql.NVarChar(64), orderId)
        .query(`SELECT ${COLS} FROM dbo.checklist_items WHERE order_id = @order_id AND deleted_at IS NULL ORDER BY position`);
      return r.recordset.map(mapChecklistItemRow);
    },
    async listDeletedByOrder(orderId) {
      const r = await pool
        .request()
        .input('order_id', sql.NVarChar(64), orderId)
        .query(`SELECT ${COLS} FROM dbo.checklist_items WHERE order_id = @order_id AND deleted_at IS NOT NULL ORDER BY position`);
      return r.recordset.map(mapChecklistItemRow);
    },
    async findById(id) {
      const r = await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .query(`SELECT ${COLS} FROM dbo.checklist_items WHERE id = @id`);
      return r.recordset[0] ? mapChecklistItemRow(r.recordset[0]) : undefined;
    },
    async insertMany(items) {
      // Checklisten sind kurz (Vorlagen-Instanziierung) — sequenzielle Inserts genuegen.
      for (const item of items) await insertOne(item);
    },
    async insert(item) {
      await insertOne(item);
    },
    async setDone(id, done) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .input('done', sql.Bit, done)
        .query('UPDATE dbo.checklist_items SET done = @done WHERE id = @id');
    },
    async softDelete(id, deletedBy, deletedAt) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .input('deleted_by', sql.NVarChar(64), deletedBy)
        .input('deleted_at', sql.DateTime2, new Date(deletedAt))
        .query('UPDATE dbo.checklist_items SET deleted_at = @deleted_at, deleted_by = @deleted_by WHERE id = @id');
    },
  };

  async function insertOne(item: ChecklistItem): Promise<void> {
    await pool
      .request()
      .input('id', sql.NVarChar(64), item.id)
      .input('order_id', sql.NVarChar(64), item.orderId)
      .input('label', sql.NVarChar(500), item.label)
      .input('done', sql.Bit, item.done)
      .input('position', sql.Int, item.position)
      .input('herkunft', sql.NVarChar(10), item.herkunft)
      .query(
        'INSERT INTO dbo.checklist_items (id, order_id, label, done, position, herkunft) VALUES (@id, @order_id, @label, @done, @position, @herkunft)'
      );
  }
}
