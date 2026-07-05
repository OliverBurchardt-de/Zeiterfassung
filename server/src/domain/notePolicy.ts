import type { Role, NoteKind } from './types';

/**
 * Note-Policy — serverseitig verbindlich (ADR-02). Wort-fuer-Wort-Spiegel der Frontend-Policy
 * `notePolicy` in src/lib/tokens.ts, damit UI-Erwartung und Server-Durchsetzung deckungsgleich sind.
 *
 * Zwei Workflows:
 *  - Frage  (Mitarbeiter): offen <-> erledigt — KEINE Partner-Freigabe.
 *  - Review (Partner):      offen -> erledigt (Mitarbeiter meldet) -> freigegeben (Partner gibt frei).
 */
export const notePolicy = {
  /** Rolle bestimmt die Art der neu angelegten Note. */
  kindFor: (role: Role): NoteKind => (role === 'partner' ? 'review' : 'frage'),
  canEditText: (_role: Role): boolean => true,
  canComment: (_role: Role): boolean => true,
  /** offen -> erledigt (Frage schliessen bzw. Review als erledigt melden): Mitarbeiter. */
  canMarkDone: (role: Role): boolean => role === 'mitarbeiter',
  /** erledigt -> offen fuer eine Frage (Rueckfrage/wieder aufnehmen): Mitarbeiter. */
  canReopenFrage: (role: Role): boolean => role === 'mitarbeiter',
  /** Nur Review-Notes durchlaufen eine Partner-Freigabe (erledigt -> freigegeben). */
  canApprove: (role: Role, kind: NoteKind): boolean => role === 'partner' && kind === 'review',
  /** Fragen entfernt der Mitarbeiter, Review-Notes der Partner. */
  canDelete: (role: Role, kind: NoteKind): boolean =>
    kind === 'frage' ? role === 'mitarbeiter' : role === 'partner',
};
