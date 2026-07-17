/**
 * Serverseitig verbindliche Ordertype-Regeln (Review 17.07.2026, P1-3 + P2-2). Bisher lagen die
 * Buchungs-/Workflow-Regeln nur im Frontend (`src/lib/art.ts`, `src/lib/ordertypes.ts`) — ein
 * direkter API-Aufruf konnte sie umgehen. Diese Datei spiegelt die fachlich relevanten Prädikate
 * für die Server-Domäne.
 *
 * BEWUSSTE DUPLIKATION (Interim, wie `checklistTemplates.ts`): abgelöst durch die server-seitig
 * verwaltete Ordertype-Konfiguration (M2-Admin, Etappe 3). Bis dahin sind die Werte hier die
 * verbindliche Untergrenze; Quelle der Wahrheit beim Abgleich ist der Frontend-Katalog.
 */

/**
 * Ordertypes, deren Zeitbuchungen eine Pflicht-Notiz brauchen — die „laufenden" Container
 * (Mehraufwand/laufende Beratung; Frontend `LAUFENDE_ORDERTYPES` → `artNeedsNotiz`).
 */
const NOTIZ_PFLICHT_ORDERTYPES = new Set(['601', '615', '616']);

/**
 * Ordertypes mit Unterlagen-Prozess — nur hier sind die Board-Status `ua`/`uv` fachlich gültig
 * (Frontend `ordertypeInfo(...).unterlagen === true`).
 */
const UNTERLAGEN_ORDERTYPES = new Set(['301', '302', '303']);

/**
 * Ordertypes mit Teilauftrags-Rhythmus (Monat/Quartal) — nur hier ist eine Teilauftragszuordnung
 * an einer Buchung fachlich sinnvoll (Frontend `teilauftragRhythmus` ≠ undefined).
 */
const TEILAUFTRAG_ORDERTYPES = new Set(['106', '107', '202', '310', '320']);

/** Braucht jede Zeitbuchung auf diesen Ordertype eine Pflicht-Notiz? */
export function ordertypeNeedsNotiz(ordertype: string): boolean {
  return NOTIZ_PFLICHT_ORDERTYPES.has(ordertype);
}

/** Ist der Unterlagen-Status (ua/uv) für diesen Ordertype zulässig? */
export function ordertypeHasUnterlagen(ordertype: string): boolean {
  return UNTERLAGEN_ORDERTYPES.has(ordertype);
}

/** Hat dieser Ordertype überhaupt Teilaufträge (sonst ist eine suborderId fachlich ungültig)? */
export function ordertypeHasTeilauftraege(ordertype: string): boolean {
  return TEILAUFTRAG_ORDERTYPES.has(ordertype);
}
