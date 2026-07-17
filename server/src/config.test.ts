import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config';

/**
 * loadConfig liest ausschliesslich process.env — fuer die Tests setzen wir die Variablen
 * gezielt und stellen sie danach wieder her (keine Wechselwirkung mit anderen Tests).
 */
const KEYS = [
  'NODE_ENV', 'COOKIE_SECRET', 'DB_MODE', 'DB_HOST', 'DB_USER', 'DB_PASSWORD',
  'DATEV_MODE', 'DATEV_AUTH', 'DATEV_USER', 'DATEV_PASSWORD', 'DATEV_TLS_INSECURE',
  'SYNC_ENABLED', 'SYNC_NIGHTLY_AT', 'SYNC_DELTA_EVERY_MIN', 'SYNC_OUTBOX_ENABLED', 'SYNC_OUTBOX_EVERY_MIN',
] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('loadConfig — Produktions-Fail-Fast', () => {
  it('Entwicklung: Memory-Modus mit Demo-Nutzern ist erlaubt (Default)', () => {
    const config = loadConfig();
    expect(config.db.mode).toBe('memory');
    expect(config.nodeEnv).toBe('development');
  });

  it('Produktion ohne DB_MODE=mssql bricht ab (Demo-Nutzer-Footgun, Codex P1)', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECRET = 'test-secret';
    expect(() => loadConfig()).toThrow(/DB_MODE=memory .* Produktion/);
  });

  it('Produktion mit DB_MODE=memory bricht ebenfalls ab (explizit gesetzt)', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECRET = 'test-secret';
    process.env.DB_MODE = 'memory';
    expect(() => loadConfig()).toThrow(/DB_MODE=memory .* Produktion/);
  });

  it('Produktion mit DB_MODE=mssql + Zugangsdaten startet', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECRET = 'test-secret';
    process.env.DB_MODE = 'mssql';
    process.env.DB_HOST = 'sql.example.local';
    process.env.DB_USER = 'app';
    process.env.DB_PASSWORD = 'pw';
    const config = loadConfig();
    expect(config.db.mode).toBe('mssql');
  });

  it('Produktion ohne COOKIE_SECRET bricht ab (bestehender Guard bleibt)', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_MODE = 'mssql';
    process.env.DB_HOST = 'sql.example.local';
    process.env.DB_USER = 'app';
    process.env.DB_PASSWORD = 'pw';
    expect(() => loadConfig()).toThrow(/COOKIE_SECRET/);
  });
});

describe('loadConfig — Synchronisierung', () => {
  it('Mock/Demo-Modus (Default): Sync aus — nichts zu spiegeln', () => {
    const config = loadConfig();
    expect(config.datev.mode).toBe('mock');
    expect(config.sync.enabled).toBe(false);
    expect(config.sync.outboxEnabled).toBe(false);
  });

  it('Echtdaten-Modus (DATEV_MODE=http): Sync + Outbox standardmaessig an', () => {
    process.env.DATEV_MODE = 'http';
    process.env.DATEV_AUTH = 'none';
    const config = loadConfig();
    expect(config.sync.enabled).toBe(true);
    expect(config.sync.outboxEnabled).toBe(true);
    expect(config.sync.nightlyAt).toBe('05:00');
  });

  it('SYNC_ENABLED=false hebelt den http-Default aus', () => {
    process.env.DATEV_MODE = 'http';
    process.env.DATEV_AUTH = 'none';
    process.env.SYNC_ENABLED = 'false';
    expect(loadConfig().sync.enabled).toBe(false);
  });

  it('ungueltiges SYNC_NIGHTLY_AT bricht ab (Fail-Fast)', () => {
    process.env.SYNC_NIGHTLY_AT = '5 Uhr';
    expect(() => loadConfig()).toThrow(/SYNC_NIGHTLY_AT/);
  });

  it('gueltige Uhrzeit + Delta werden uebernommen', () => {
    process.env.SYNC_NIGHTLY_AT = '23:30';
    process.env.SYNC_DELTA_EVERY_MIN = '45';
    const config = loadConfig();
    expect(config.sync.nightlyAt).toBe('23:30');
    expect(config.sync.deltaEveryMin).toBe(45);
  });
});
