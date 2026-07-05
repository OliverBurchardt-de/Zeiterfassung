import type { Repositories } from '../ports';
import { type Clock, systemClock } from '../clock';
import { createTimeActions } from './time';
import { createNoteActions } from './notes';
import { createStatusActions } from './status';

/**
 * Buendelt die serverseitigen Fach-Aktionen ueber den Repositories. Uhr/ID-Erzeugung sind
 * einspeisbar (Tests deterministisch); im Betrieb die systemClock. Die API-Routen rufen nur
 * diese Aktionen — die gesamte Fachlogik/Rechtepruefung liegt hier, nicht in der Route.
 */
export function createActions(repos: Repositories, clock: Clock = systemClock) {
  return {
    time: createTimeActions(repos, clock),
    notes: createNoteActions(repos, clock),
    status: createStatusActions(repos, clock),
  };
}

export type Actions = ReturnType<typeof createActions>;

export type { BookTimeInput, TimeActions } from './time';
export type { CreateNoteInput, NoteThread, NoteActions } from './notes';
export type { StatusActions } from './status';
