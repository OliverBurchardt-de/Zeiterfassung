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
  const datev = createDatevAdapter(config);
  const deps = {
    sessions: createMemorySessionStore(config.sessionTtlMs),
    users: repos.users,
    datev,
    actions: createActions(repos, datev),
  };
  const app = buildApp(config, deps);
  await app.listen({ port: config.port, host: config.host });

  // Start-Rueckmeldung im Echtdaten-Modus: dem Bediener sofort zeigen, ob die DATEV-Verbindung
  // steht — ohne schweren getOrders()-Abruf. Nicht-fatal: ein DATEV-Ausfall bricht den Start nicht ab.
  if (config.datev.mode === 'http') {
    // eslint-disable-next-line no-console
    console.log(`[DATEV] Modus http — ${config.datev.baseUrl} (Auth: ${config.datev.auth})`);
    try {
      const ok = await datev.health();
      // eslint-disable-next-line no-console
      console.log(ok ? '[DATEV] erreichbar.' : '[DATEV] NICHT erreichbar (health lieferte kein OK).');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.log(`[DATEV] NICHT erreichbar: ${msg}`);
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
