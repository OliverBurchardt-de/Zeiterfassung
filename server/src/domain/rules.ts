/**
 * Reine Fachregeln (ohne DB/DATEV) — leicht testbar (ADR-10). Spiegelt die im Frontend
 * (M1) bereits getesteten Selektoren; in M2 ist DIESE Server-Variante verbindlich.
 */

export interface ChecklistItem {
  done: boolean;
  label?: string;
  herkunft?: 'vorlage' | 'manuell';
}

/**
 * „Erledigt" ist erst moeglich, wenn (1) alle aktiven Punkte erledigt sind UND (2) alle
 * serverseitigen Pflicht-Labels als Vorlage-Punkte vorhanden sind (Review P1-1). Ohne (2) liesse
 * sich das Gate mit einer leeren oder verkuerzten Liste umgehen. `mandatoryLabels` leer = kein
 * Pflicht-Katalog fuer diesen Ordertype (dann genuegt (1)).
 */
export function canCompleteOrder(items: ChecklistItem[], mandatoryLabels: string[] = []): boolean {
  if (!items.every((i) => i.done)) return false;
  const vorlageLabels = new Set(
    items.filter((i) => (i.herkunft ?? 'vorlage') === 'vorlage').map((i) => i.label)
  );
  return mandatoryLabels.every((l) => vorlageLabels.has(l));
}

/**
 * Eine Zeitbuchung braucht eine positive, plausible Dauer — Grenzen zentral in limits.ts
 * (max. ein Tag, DECIMAL(9,2)-Genauigkeit; Review 12.07.2026, P2.4).
 */
export { isValidDauer as isValidTimeDuration } from './limits';

// Die Umplanungs-Regeln (1x/Jahr frei fuer JA/ESt) kommen mit der Umplanungs-Aktion
// (Etappe 3) hierher — Vorlage: src/lib/regeln.ts im Frontend.
