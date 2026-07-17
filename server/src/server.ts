import { loadConfig } from './config';
import { buildApp } from './app';
import { createMemorySessionStore } from './auth/sessions';
import { seedDemoUsers } from './infra/memory/users';
import { createMemoryRepositories } from './infra/memory/repos';
import { createPool } from './infra/mssql/db';
import { createMssqlRepositories } from './infra/mssql';
import { createActions } from './domain/actions';
import { createDatevAdapter } from './datev';
import { createOrderSnapshot } from './sync/orderSnapshot';
import { createSnapshotBackedDatev } from './sync/snapshotDatev';
import { runOrderSync } from './sync/syncOrders';
import { runOutboxDrain } from './sync/outboxWorker';
import { scheduleDaily, scheduleInterval } from './sync/scheduler';

/**
 * Einstiegspunkt. Verdrahtet Persistenz (Memory oder MS SQL je nach DB_MODE), den DATEV-Adapter
 * (Schein oder echt je nach DATEV_MODE) und — im Echtdaten-Modus — die automatische
 * Synchronisierung (Snapshot + Zeitplaner + Outbox, docs/synchronisierung-konzept.md).
 * buildApp bleibt in allen Faellen gleich.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  // eslint-disable-next-line no-console
  const log = (msg: string): void => console.log(msg);
  const nowIso = (): string => new Date().toISOString();

  const repos =
    config.db.mode === 'mssql'
      ? createMssqlRepositories(await createPool(config.db))
      : createMemoryRepositories(await seedDemoUsers());

  // Der echte Adapter spricht mit DATEV; die Lese-Weiche legt bei aktivem Sync den Snapshot davor,
  // damit das Board sofort liest statt jeden Aufruf live zu holen.
  const rawDatev = createDatevAdapter(config);
  const snapshot = createOrderSnapshot();
  const datev = config.sync.enabled
    ? createSnapshotBackedDatev(rawDatev, snapshot, log, nowIso)
    : rawDatev;

  const deps = {
    sessions: createMemorySessionStore(config.sessionTtlMs),
    users: repos.users,
    datev,
    actions: createActions(repos, datev),
  };
  const app = buildApp(config, deps);
  await app.listen({ port: config.port, host: config.host });

  if (config.datev.mode === 'http') {
    log(`[DATEV] Modus http — ${config.datev.baseUrl} (Auth: ${config.datev.auth})`);
    try {
      const ok = await rawDatev.health();
      log(ok ? '[DATEV] erreichbar.' : '[DATEV] NICHT erreichbar (health lieferte kein OK).');
    } catch (err) {
      log(`[DATEV] NICHT erreichbar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (config.sync.enabled) {
    // Beim Hochfahren einmal sofort fuellen (der Snapshot ist nach einem Neustart leer) —
    // im Hintergrund, damit der Start nicht blockiert, und nicht-fatal.
    log(`[Sync] aktiv — naechtlicher Voll-Lauf um ${config.sync.nightlyAt}` +
      (config.sync.deltaEveryMin > 0 ? `, Delta alle ${config.sync.deltaEveryMin} Min.` : ', kein Delta') + '.');
    void runOrderSync(rawDatev, snapshot, log, nowIso()).catch((err) =>
      log(`[Sync] Erst-Lauf fehlgeschlagen (Board laedt beim ersten Aufruf live): ${err instanceof Error ? err.message : String(err)}`),
    );
    // Der naechtliche Wecker: rechnet bis zur Uhrzeit, laeuft, stellt sich selbst neu.
    scheduleDaily(config.sync.nightlyAt, () => runOrderSync(rawDatev, snapshot, log, nowIso()).then(() => undefined), log);
    if (config.sync.deltaEveryMin > 0) {
      scheduleInterval(config.sync.deltaEveryMin * 60_000, () => runOrderSync(rawDatev, snapshot, log, nowIso()).then(() => undefined), log);
    }
  }

  if (config.sync.outboxEnabled) {
    log(`[Outbox] Arbeiter aktiv — alle ${config.sync.outboxEveryMin} Min.`);
    scheduleInterval(config.sync.outboxEveryMin * 60_000, () => runOutboxDrain(repos.outbox, rawDatev, log).then(() => undefined), log);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
