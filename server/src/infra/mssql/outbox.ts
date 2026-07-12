import type { ConnectionPool, Request } from 'mssql';
import { sql } from './db';
import type { OutboxEntry, OutboxKind, OutboxStatus } from '../../domain/types';
import type { OutboxRepository } from '../../domain/ports';
import { isoDateTime, optionalIsoDateTime, optionalString } from './rows';

/** DB-Zeile (dbo.outbox) -> Domaenen-OutboxEntry. Reine Funktion (testbar ohne DB). */
export function mapOutboxRow(row: Record<string, unknown>): OutboxEntry {
  return {
    id: String(row.id),
    kind: String(row.kind) as OutboxKind,
    payload: String(row.payload),
    idempotencyKey: String(row.idempotency_key),
    status: (row.status === 'uebertragen' || row.status === 'fehler' ? row.status : 'offen') as OutboxStatus,
    attempts: Number(row.attempts ?? 0),
    lastError: optionalString(row.last_error),
    createdAt: isoDateTime(row.created_at),
    processedAt: optionalIsoDateTime(row.processed_at),
  };
}

const COLS = 'id, kind, payload, idempotency_key, status, attempts, last_error, created_at, processed_at';

/**
 * Enqueue als eigenstaendiges Statement — Pool (Repo) oder laufende Transaktion
 * (StatusWechselTransaktion, Review P2.6); den Request stellt der Aufrufer.
 */
export async function enqueueOutboxStatement(request: Request, e: OutboxEntry): Promise<void> {
  await request
    .input('id', sql.NVarChar(64), e.id)
    .input('kind', sql.NVarChar(30), e.kind)
    .input('payload', sql.NVarChar(sql.MAX), e.payload)
    .input('idempotency_key', sql.NVarChar(100), e.idempotencyKey)
    .input('status', sql.NVarChar(20), e.status)
    .input('attempts', sql.Int, e.attempts)
    .input('created_at', sql.DateTime2, new Date(e.createdAt))
    .query(
      `INSERT INTO dbo.outbox (id, kind, payload, idempotency_key, status, attempts, created_at)
       VALUES (@id, @kind, @payload, @idempotency_key, @status, @attempts, @created_at)`
    );
}

export function createMssqlOutboxRepository(pool: ConnectionPool): OutboxRepository {
  return {
    async enqueue(e) {
      await enqueueOutboxStatement(pool.request(), e);
    },
    async nextOpen(limit) {
      const r = await pool
        .request()
        .input('limit', sql.Int, limit)
        .query(`SELECT TOP (@limit) ${COLS} FROM dbo.outbox WHERE status = 'offen' ORDER BY created_at`);
      return r.recordset.map(mapOutboxRow);
    },
    async markUebertragen(id) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .query("UPDATE dbo.outbox SET status = 'uebertragen', processed_at = SYSUTCDATETIME() WHERE id = @id");
    },
    async markFehlversuch(id, error) {
      // Bleibt 'offen' — der Sync-Job versucht es beim naechsten Lauf erneut.
      await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .input('error', sql.NVarChar(sql.MAX), error)
        .query('UPDATE dbo.outbox SET attempts = attempts + 1, last_error = @error WHERE id = @id');
    },
    async markFehler(id, error) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .input('error', sql.NVarChar(sql.MAX), error)
        .query("UPDATE dbo.outbox SET status = 'fehler', attempts = attempts + 1, last_error = @error WHERE id = @id");
    },
  };
}
