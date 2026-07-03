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
    // Benannte Instanz (z. B. SQLEXPRESS) hat Vorrang; sonst fester Port.
    ...(cfg.instanceName ? {} : { port: cfg.port }),
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    options: {
      encrypt: cfg.encrypt,
      trustServerCertificate: cfg.trustServerCertificate,
      // Datumswerte konsequent als UTC lesen/schreiben — die Domaene arbeitet mit
      // ISO-Strings; ohne Festlegung hinge z. B. das work_date von der Server-Zeitzone ab.
      useUTC: true,
      ...(cfg.instanceName ? { instanceName: cfg.instanceName } : {}),
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  });
  await pool.connect();
  return pool;
}

export type { ConnectionPool } from 'mssql';
export { sql };
