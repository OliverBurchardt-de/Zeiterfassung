import { loadConfig } from './config';
import { buildApp } from './app';
import { createMemorySessionStore } from './auth/sessions';
import { seedDemoUsers, createMemoryUserRepository } from './infra/memory/users';
import { createPool } from './infra/mssql/db';
import { createMssqlUserRepository } from './infra/mssql/users';
import { createDatevAdapter } from './datev';

/**
 * Einstiegspunkt. Verdrahtet Persistenz (Memory oder MS SQL je nach DB_MODE) und den
 * DATEV-Adapter (Schein oder echt je nach DATEV_MODE) — buildApp bleibt in allen Faellen gleich.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const users =
    config.db.mode === 'mssql'
      ? createMssqlUserRepository(await createPool(config.db))
      : createMemoryUserRepository(await seedDemoUsers());
  const deps = {
    sessions: createMemorySessionStore(config.sessionTtlMs),
    users,
    datev: createDatevAdapter(config),
  };
  const app = buildApp(config, deps);
  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
