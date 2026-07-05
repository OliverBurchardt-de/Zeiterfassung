import { API_MODE } from '@/api/mode';
import { HEUTE } from '@/mock/orders';

/**
 * Fachliches „Heute" (ISO "JJJJ-MM-TT") — die EINZIGE Quelle überall dort, wo mit dem aktuellen
 * Tag gerechnet wird (Arbeitsdatum von Buchungen, „Heute erfasst", Überfällig-Stichtag, …):
 *  - Demo-Modus: der feste Demo-Stichtag HEUTE (deterministische Mock-Daten/Auswertungen).
 *  - Server-Modus: das echte Tagesdatum — sonst würden manuelle Buchungen mit dem Mock-Datum
 *    als DATEV work_date persistiert (Codex-Review P1).
 */
export function heute(): string {
  return API_MODE ? new Date().toISOString().slice(0, 10) : HEUTE;
}
