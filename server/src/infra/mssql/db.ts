import sql from 'mssql';
import type { DbConfig } from '../../config';

/**
 * MS-SQL-Verbindungs-Pool (mssql/tedious — reines JavaScript, keine nativen Binaerdateien;
 * bewusst statt Prisma gewaehlt, siehe ADR-04-Aenderungsvermerk). Ein Pool pro Prozess;
 * die Repositories teilen ihn sich.
 */
export async function createPool(cfg: DbConfig): Promise<sql.ConnectionPool> {
  const pool = new sql.ConnectionPool({
    server: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    options: {
      encrypt: cfg.encrypt,
      trustServerCertificate: cfg.trustServerCertificate,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  });
  await pool.connect();
  return pool;
}

export type { ConnectionPool } from 'mssql';
export { sql };
