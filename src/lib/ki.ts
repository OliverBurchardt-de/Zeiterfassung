import type { Aufwandsart } from './types';

/**
 * KI-Prüfung von Buchungs-Notizen — technischer Platzhalter (Umsetzung in V2).
 *
 * Idee: Bei der **Freigabe** einer laufenden Buchung (insb. Mehraufwand / Dumm gelaufen,
 * Steuerberatung) wird die Notiz über eine API an eine KI/ein LLM gegeben, die prüft:
 *  - passt die gewählte **Kategorie** (Mehraufwand vs. Dumm gelaufen) zum Text?
 *  - **Rechtschreibung** korrekt?
 *  - ist die **Beschreibung ausreichend** (aussagekräftig genug für Abrechnung/Mandant)?
 *
 * Die saubere Definition (Prompt, Schwellen, Workflow bei „nicht ok") folgt in V2. Hier wird die
 * Schnittstelle nur **vorgesehen**, damit der Freigabe-Pfad sie später ohne Umbau aufrufen kann.
 */
export interface KiPruefung {
  kategorieOk: boolean;
  rechtschreibungOk: boolean;
  ausreichend: boolean;
  hinweis?: string;
}

export interface KiPruefungInput {
  text: string;
  aufwandsart?: Aufwandsart;
}

/**
 * Platzhalter — noch nicht aktiv. Liefert `null` (keine Prüfung durchgeführt).
 * In V2: echte API-/LLM-Anbindung; Aufrufstelle ist die Zeit-Freigabe durch den Mitarbeiter (store.releaseTime).
 */
export async function pruefeNotizKI(_input: KiPruefungInput): Promise<KiPruefung | null> {
  return null;
}
