import type { Repositories, DatevPort } from '../ports';
import { type Clock, systemClock } from '../clock';
import { createOrderAccess } from './access';
import { createTimeActions } from './time';
import { createNoteActions } from './notes';
import { createStatusActions } from './status';

/**
 * Buendelt die serverseitigen Fach-Aktionen ueber den Repositories. Der DATEV-Port liefert die
 * Auftrags-Stammdaten fuer die Zugriffspruefung (`requireVisibleOrder`), die JEDE auftragsbezogene
 * Aktion durchlaeuft. Uhr/ID-Erzeugung sind einspeisbar (Tests deterministisch). Die API-Routen
 * rufen nur diese Aktionen — die gesamte Fachlogik/Rechtepruefung liegt hier, nicht in der Route.
 */
export function createActions(repos: Repositories, datev: DatevPort, clock: Clock = systemClock) {
  const requireVisibleOrder = createOrderAccess(datev);
  return {
    time: createTimeActions(repos, clock, requireVisibleOrder),
    notes: createNoteActions(repos, clock, requireVisibleOrder),
    status: createStatusActions(repos, clock, requireVisibleOrder),
  };
}

export type Actions = ReturnType<typeof createActions>;

export type { BookTimeInput, TimeActions } from './time';
export type { CreateNoteInput, NoteThread, NoteActions } from './notes';
export type { StatusActions } from './status';
