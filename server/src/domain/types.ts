/** Fachliche Kerntypen der Domain-Schicht. Kennen weder Datenbank noch DATEV. */

export type Role = 'mitarbeiter' | 'partner';

export type TimeStatus = 'erfasst' | 'freigegeben' | 'uebertragen';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  admin: boolean;
  passwordHash: string;
  datevEmployeeId?: string;
}

/** Nutzer-Sicht ohne Geheimnisse — alles, was nach aussen gehen darf. */
export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(u: User): PublicUser {
  const { passwordHash: _passwordHash, ...pub } = u;
  return pub;
}

/** Vereinfachte Auftrags-Sicht, wie sie der DATEV-Adapter liefert (projiziert aus dem EO-Order). */
export interface OrderView {
  id: string;
  orderNumber: number;
  ordertype: string;
  name: string;
  status: string;
  clientId: string;
  responsibleId?: string;
  isInternal: boolean;
  plannedHours: number;
  assessmentYear?: number;
}
