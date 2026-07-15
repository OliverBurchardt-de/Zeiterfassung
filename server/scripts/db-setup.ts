import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../src/config';
import { createPool, sql } from '../src/infra/mssql/db';
import { hashPassword } from '../src/auth/passwords';

/**
 * Richtet die Datenbank ein: fuehrt db/schema.sql aus (idempotent — kann mehrfach laufen),
 * wendet danach ausstehende nummerierte Migrationen aus db/migrations/ in Dateinamens-
 * Reihenfolge an (Protokoll in dbo.schema_migrations) und legt, falls noch KEIN Nutzer
 * existiert, den ersten Admin an. Vorgehen/Backup: db/migrations/README.md.
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

  // Migrationen: nummerierte Deltas fuer BESTEHENDE Datenbanken (Neuinstallationen sind durch
  // schema.sql bereits aktuell; die Migrationen selbst sind guarded/idempotent und daher auch
  // dort gefahrlos). Jede angewendete Datei wird in dbo.schema_migrations protokolliert.
  const migrationsDir = join(__dirname, '..', 'db', 'migrations');
  if (existsSync(migrationsDir)) {
    const dateien = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    const applied = new Set(
      (await pool.request().query('SELECT id FROM dbo.schema_migrations')).recordset.map((r) => String(r.id)),
    );
    for (const datei of dateien) {
      if (applied.has(datei)) continue;
      const sqlText = readFileSync(join(migrationsDir, datei), 'utf8');
      const teile = sqlText.split(/^\s*GO\s*$/m).filter((b) => b.trim().length > 0);
      for (const teil of teile) await pool.request().batch(teil);
      await pool
        .request()
        .input('id', sql.NVarChar(200), datei)
        .query('INSERT INTO dbo.schema_migrations (id) VALUES (@id)');
      console.log(`Migration angewendet: ${datei}`);
    }
    const offen = dateien.filter((f) => !applied.has(f)).length;
    if (offen === 0) console.log('Keine ausstehenden Migrationen.');
  }

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
    } else if (password.length < 8) {
      console.log('SETUP_ADMIN_PASSWORD hat weniger als 8 Zeichen (Passwortregel, s. README) — kein Admin angelegt.');
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
