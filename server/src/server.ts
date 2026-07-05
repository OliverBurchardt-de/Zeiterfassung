import { loadConfig } from './config';
import { buildApp } from './app';
import { createMemorySessionStore } from './auth/sessions';
import { seedDemoUsers } from './infra/memory/users';
import { createMemoryRepositories } from './infra/memory/repos';
import { createPool } from './infra/mssql/db';
import { createMssqlRepositories } from './infra/mssql';
import { createActions } from './domain/actions';
import { createDatevAdapter } from './datev';

/**
 * Einstiegspunkt. Verdrahtet Persistenz (Memory oder MS SQL je nach DB_MODE) und den
 * DATEV-Adapter (Schein oder echt je nach DATEV_MODE) — buildApp bleibt in allen Faellen gleich.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const repos =
    config.db.mode === 'mssql'
      ? createMssqlRepositories(await createPool(config.db))
      : createMemoryRepositories(await seedDemoUsers());
  const deps = {
    sessions: createMemorySessionStore(config.sessionTtlMs),
    users: repos.users,
    datev: createDatevAdapter(config),
    actions: createActions(repos),
  };
  const app = buildApp(config, deps);
  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
