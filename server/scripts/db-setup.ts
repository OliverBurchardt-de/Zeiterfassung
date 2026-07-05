import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../src/config';
import { createPool, sql } from '../src/infra/mssql/db';
import { hashPassword } from '../src/auth/passwords';

/**
 * Richtet die Datenbank ein: fuehrt db/schema.sql aus (idempotent — kann mehrfach laufen)
 * und legt, falls noch KEIN Nutzer existiert, den ersten Admin an.
 *
 * Aufruf:  npm run db:setup
 * Voraussetzung: .env mit DB_MODE=mssql, DB_HOST, DB_NAME, DB_USER, DB_PASSWORD.
 * Erster Admin (nur beim allerersten Lauf noetig):
 *   SETUP_ADMIN_USER / SETUP_ADMIN_NAME / SETUP_ADMIN_EMAIL / SETUP_ADMIN_PASSWORD
 */
async function main(): Promise<void> {
  const config = loadConfig();
  if (config.db.mode !== 'mssql') {
    throw new Error('DB_MODE=mssql setzen (samt DB_HOST/DB_USER/DB_PASSWORD), dann erneut ausfuehren.');
  }

  console.log(`Verbinde mit ${config.db.host}:${config.db.port} / Datenbank "${config.db.database}" ...`);
  const pool = await createPool(config.db);
  console.log('Verbunden.');

  // Schema anwenden (idempotent; auf GO-Trenner splitten, falls spaeter welche dazukommen)
  const ddl = readFileSync(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const batches = ddl.split(/^\s*GO\s*$/m).filter((b) => b.trim().length > 0);
  for (const batch of batches) {
    await pool.request().batch(batch);
  }
  console.log(`Schema angewendet (${batches.length} Batch${batches.length === 1 ? '' : 'es'}).`);

  // Ersten Admin anlegen, wenn die Nutzer-Tabelle leer ist
  const count = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.users');
  if (count.recordset[0].n === 0) {
    const username = process.env.SETUP_ADMIN_USER ?? '';
    const name = process.env.SETUP_ADMIN_NAME ?? '';
    const email = process.env.SETUP_ADMIN_EMAIL ?? '';
    const password = process.env.SETUP_ADMIN_PASSWORD ?? '';
    if (!username || !password || !email) {
      console.log(
        'Nutzer-Tabelle ist leer. Zum Anlegen des ersten Admins SETUP_ADMIN_USER, ' +
          'SETUP_ADMIN_EMAIL und SETUP_ADMIN_PASSWORD setzen und erneut ausfuehren.',
      );
    } else {
      const hash = await hashPassword(password);
      await pool
        .request()
        .input('id', sql.NVarChar(64), randomUUID())
        .input('username', sql.NVarChar(200), username)
        .input('email', sql.NVarChar(320), email)
        .input('name', sql.NVarChar(200), name || username)
        .input('hash', sql.NVarChar(200), hash)
        .query(
          `INSERT INTO dbo.users (id, username, email, name, role, admin, password_hash, active)
           VALUES (@id, @username, @email, @name, 'partner', 1, @hash, 1)`,
        );
      console.log(`Erster Admin "${username}" angelegt (Rolle Partner + Admin).`);
    }
  } else {
    console.log(`Nutzer vorhanden (${count.recordset[0].n}) — kein Admin-Seed noetig.`);
  }

  await pool.close();
  console.log('Fertig.');
}

main().catch((err) => {
  console.error('db:setup fehlgeschlagen:', err instanceof Error ? err.message : err);
  process.exit(1);
});
