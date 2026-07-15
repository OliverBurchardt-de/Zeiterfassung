import type { ConnectionPool } from 'mssql';
import type { Repositories } from '../../domain/ports';
import { createMssqlUserRepository } from './users';
import { createMssqlTimeEntryRepository } from './times';
import { createMssqlNoteRepository } from './notes';
import { createMssqlOverlayRepository } from './overlays';
import { createMssqlChecklistRepository } from './checklists';
import { createMssqlStatusHistoryRepository } from './statusHistory';
import { createMssqlOutboxRepository } from './outbox';
import { createMssqlAnforderungRepository } from './anforderungen';
import { createMssqlBesonderheitRepository } from './besonderheiten';
import { createMssqlStatusWechselTransaktion } from './transaktion';

/** Das komplette Buendel fuer DB_MODE=mssql — Gegenstueck zu createMemoryRepositories. */
export function createMssqlRepositories(pool: ConnectionPool): Repositories {
  return {
    users: createMssqlUserRepository(pool),
    times: createMssqlTimeEntryRepository(pool),
    notes: createMssqlNoteRepository(pool),
    overlays: createMssqlOverlayRepository(pool),
    checklists: createMssqlChecklistRepository(pool),
    statusHistory: createMssqlStatusHistoryRepository(pool),
    outbox: createMssqlOutboxRepository(pool),
    anforderungen: createMssqlAnforderungRepository(pool),
    besonderheiten: createMssqlBesonderheitRepository(pool),
    statusTransaktion: createMssqlStatusWechselTransaktion(pool),
  };
}
