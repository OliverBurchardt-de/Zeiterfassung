import type { ConnectionPool } from 'mssql';
import { sql } from './db';
import type { StatusWechselTransaktion } from '../../domain/ports';
import { upsertOverlayStatement } from './overlays';
import { insertStatusChangeStatement } from './statusHistory';
import { enqueueOutboxStatement } from './outbox';

/**
 * Statuswechsel atomar (Review 12.07.2026, P2.6): Overlay + Historie (+ optional Outbox) in
 * EINER SQL-Transaktion — entweder alles oder nichts. Nutzt dieselben Statement-Funktionen wie
 * die Einzel-Repos (kein dupliziertes SQL).
 */
export function createMssqlStatusWechselTransaktion(pool: ConnectionPool): StatusWechselTransaktion {
  return {
    async commitStatusWechsel(overlay, change, outboxEntry) {
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        await upsertOverlayStatement(tx.request(), overlay);
        if (change) await insertStatusChangeStatement(tx.request(), change);
        if (outboxEntry) await enqueueOutboxStatement(tx.request(), outboxEntry);
        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    },
  };
}
