import { randomUUID } from 'node:crypto';

/**
 * Uhr + ID-Erzeugung als einspeisbare Abhaengigkeiten — so laufen die Domaenen-Aktionen
 * in Tests deterministisch (feste Zeit/IDs), im Betrieb mit echten Werten.
 */
export interface Clock {
  /** Aktueller Zeitpunkt als ISO-String (UTC). */
  now(): string;
  /** Neue, kollisionsfreie ID (UUID v4). */
  newId(): string;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  newId: () => randomUUID(),
};
