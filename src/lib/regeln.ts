import type { Order } from './types';

/**
 * Reine Umplanungs-Fachregeln (JA/ESt) — ohne Store-/UI-Abhängigkeit, damit sowohl die
 * Selektoren (Anzeige) als auch die Store-Guards (Durchsetzung) dieselbe Quelle nutzen.
 * In M2 verbindlich serverseitig gespiegelt (server/src/domain/rules.ts).
 */

/** Freie Umplanungen pro Veranlagungsjahr, bevor eine Partner-Freigabe nötig wird. */
export const FREIE_UMPLANUNGEN_PRO_JAHR = 1;

/**
 * Gilt für den Auftrag die Sonderregel „1× Umplanung pro VJ frei, danach Partner-Freigabe"?
 * Abgestimmt: nur Jahresabschluss (`ja`) und Einkommensteuer/Private Steuern (`est`).
 */
export function umplanungRegelGilt(o: Order): boolean {
  return o.artKey === 'ja' || o.artKey === 'est';
}

/**
 * Darf der Auftrag OHNE Partner-Freigabe (um)geplant werden?
 * - Erstplanung (noch kein Monat) ist immer frei.
 * - JA/ESt: solange das Freikontingent des VJ nicht aufgebraucht ist.
 * - Alle übrigen Arten: nein — jede Umplanung erfordert die Partner-Freigabe (CLAUDE.md).
 */
export function umplanungFreiMoeglich(o: Order): boolean {
  if (!o.monat) return true;
  if (!umplanungRegelGilt(o)) return false;
  return (o.umplanungenVerbraucht ?? 0) < FREIE_UMPLANUNGEN_PRO_JAHR;
}

/** Verbleibende freie Umplanungen des Auftrags im VJ (nur sinnvoll, wenn die Regel gilt). */
export function freieUmplanungenRest(o: Order): number {
  return Math.max(0, FREIE_UMPLANUNGEN_PRO_JAHR - (o.umplanungenVerbraucht ?? 0));
}
