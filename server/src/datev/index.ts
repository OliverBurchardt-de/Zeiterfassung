import type { DatevPort } from '../domain/ports';
import type { Config } from '../config';
import { createMockDatevAdapter } from './mockAdapter';
import { createHttpDatevAdapter } from './httpAdapter';

/**
 * Waehlt den DATEV-Adapter anhand der Konfiguration: `DATEV_MODE=http` = echter DATEVconnect-Zugriff,
 * sonst der Schein-Adapter (Default, ohne Netz). Beide erfuellen denselben DatevPort — die uebrige
 * App bleibt gleich (ADR-05).
 */
export function createDatevAdapter(config: Config): DatevPort {
  return config.datev.mode === 'http'
    ? createHttpDatevAdapter(config.datev)
    : createMockDatevAdapter();
}
