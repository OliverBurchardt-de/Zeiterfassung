import { loadConfig } from './config';
import { buildApp } from './app';
import { createMemorySessionStore } from './auth/sessions';
import { seedDemoUsers, createMemoryUserRepository } from './infra/memory/users';
import { createDatevAdapter } from './datev';

/**
 * Einstiegspunkt fuer die Entwicklung. Verdrahtet die In-Memory-Infrastruktur und den DATEV-Adapter
 * (Schein oder echt je nach DATEV_MODE). Die Persistenz wird spaeter durch Prisma (MS SQL) ersetzt —
 * buildApp bleibt gleich.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const users = createMemoryUserRepository(await seedDemoUsers());
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
