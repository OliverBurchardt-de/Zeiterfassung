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
  const { passwordHash, ...pub } = u;
  void passwordHash; // bewusst verworfen — nie nach aussen geben
  return pub;
}

/**
 * Vereinfachte Auftrags-Sicht, wie sie der DATEV-Adapter liefert (projiziert aus dem EO-Order,
 * Feld-Referenz: docs/datev-connect-handoff.md §3b).
 * Konvention: DATEV liefert `id`/`order_id` als Integer — der Adapter konvertiert nach String
 * (stabile, vergleichbare Schlüssel im App-Kontext); zurück Richtung DATEV wird wieder geparst.
 */
export interface OrderView {
  id: string;
  orderNumber: number;
  /** DATEV creation_year — order_number ist nur zusammen mit dem Anlagejahr eindeutig. */
  creationYear?: number;
  ordertype: string;
  name: string;
  status: string;
  clientId: string;
  /** DATEV order_responsible1_id → App-Nutzer (Bearbeiter). */
  responsibleId?: string;
  /** DATEV order_partner_id → mandatsverantwortlicher Partner (Basis der Partner-Sichtbarkeit). */
  partnerId?: string;
  isInternal: boolean;
  plannedHours: number;
  assessmentYear?: number;
  /** DATEV billing_status — Quelle des Controllings „noch nicht abgerechnet". */
  billingStatus?: string;
}
