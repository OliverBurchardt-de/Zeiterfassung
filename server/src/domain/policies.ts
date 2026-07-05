import type { Role } from './types';

/**
 * Rollen-Policy — zentral, wird serverseitig durchgesetzt (ADR-02).
 * Spiegelt die Frontend-Policy; die verbindliche Pruefung liegt hier auf dem Server.
 */
export const rolePolicy = {
  /** Umplanung anfordern darf der Mitarbeiter. */
  canRequestUmplanung: (role: Role): boolean => role === 'mitarbeiter',
  /** Umplanung freigeben darf der (mandatsverantwortliche) Partner. */
  canApproveUmplanung: (role: Role): boolean => role === 'partner',
  /** Eigene Zeiten gibt der Mitarbeiter selbst frei (keine Partner-Freigabe). */
  canReleaseOwnTime: (role: Role): boolean => role === 'mitarbeiter',
};
