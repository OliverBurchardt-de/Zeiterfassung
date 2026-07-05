import type { ConnectionPool } from 'mssql';
import { sql } from './db';
import type { OrderOverlay } from '../../domain/types';
import type { OverlayRepository } from '../../domain/ports';
import { optionalNumber, optionalString } from './rows';

/** DB-Zeile (dbo.order_overlays) -> Domaenen-Overlay. Reine Funktion (testbar ohne DB). */
export function mapOverlayRow(row: Record<string, unknown>): OrderOverlay {
  return {
    orderId: String(row.order_id),
    boardStatus: optionalString(row.board_status),
    boardPosition: optionalNumber(row.board_position),
    umplanungenVerbraucht: Number(row.umplanungen_verbraucht ?? 0),
  };
}

const COLS = 'order_id, board_status, board_position, umplanungen_verbraucht';

export function createMssqlOverlayRepository(pool: ConnectionPool): OverlayRepository {
  return {
    async get(orderId) {
      const r = await pool
        .request()
        .input('order_id', sql.NVarChar(64), orderId)
        .query(`SELECT ${COLS} FROM dbo.order_overlays WHERE order_id = @order_id`);
      return r.recordset[0] ? mapOverlayRow(r.recordset[0]) : undefined;
    },
    async list() {
      const r = await pool.request().query(`SELECT ${COLS} FROM dbo.order_overlays`);
      return r.recordset.map(mapOverlayRow);
    },
    async upsert(o) {
      // UPDATE, sonst INSERT — ein Batch, kein MERGE noetig (ein Schreiber pro Auftrag genuegt hier).
      await pool
        .request()
        .input('order_id', sql.NVarChar(64), o.orderId)
        .input('board_status', sql.NVarChar(4), o.boardStatus ?? null)
        .input('board_position', sql.Int, o.boardPosition ?? null)
        .input('umplanungen_verbraucht', sql.Int, o.umplanungenVerbraucht)
        .query(
          `UPDATE dbo.order_overlays
           SET board_status = @board_status, board_position = @board_position,
               umplanungen_verbraucht = @umplanungen_verbraucht, updated_at = SYSUTCDATETIME()
           WHERE order_id = @order_id;
           IF @@ROWCOUNT = 0
             INSERT INTO dbo.order_overlays (${COLS})
             VALUES (@order_id, @board_status, @board_position, @umplanungen_verbraucht);`
        );
    },
  };
}
