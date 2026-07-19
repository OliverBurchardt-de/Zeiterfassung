/**
 * Antwort-Formen der Server-API (DTOs) — Spiegel der Server-Typen:
 *  - ApiUser:      server/src/domain/types.ts `PublicUser`
 *  - ApiBoardOrder server/src/domain/actions/board.ts `BoardOrder` (inkl. OrderView-Feldern)
 * Die Umwandlung ins Frontend-Modell (`Order`, `User`) macht `src/api/mapping.ts`.
 */

import type { Role } from '@/lib/types';

export interface ApiUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  admin: boolean;
  datevEmployeeId?: string;
  /** Tageslimit „Kanzleiverwaltung" in Minuten; undefined = unbegrenzt. */
  kvLimitMin?: number;
}

export interface ApiTimeEntry {
  id: string;
  userId: string;
  orderId: string;
  suborderId?: string;
  datum: string; // ISO "JJJJ-MM-TT" (DATEV work_date)
  dauer: number; // Stunden dezimal
  notiz?: string;
  status: 'erfasst' | 'freigegeben' | 'uebertragen';
  aufwandsart?: 'mehraufwand' | 'dumm';
  createdAt: string;
}

/** Eingabe der Zeitbuchung (POST /api/time) — Spiegel von server BookTimeInput. */
export interface ApiBookTimeInput {
  orderId: string;
  suborderId?: string;
  datum: string; // ISO "JJJJ-MM-TT"
  dauer: number;
  notiz?: string;
  aufwandsart?: 'mehraufwand' | 'dumm';
  /** Verhindert Doppelbuchung bei Retry; hier zugleich die temporäre Client-ID des Eintrags. */
  idempotencyKey?: string;
}

/**
 * Server-Antworten der Schreib-Endpunkte, soweit das Frontend sie auswertet. Wir brauchen im
 * optimistischen Modell nur die vergebene ID (Abgleich temporäre ↔ echte ID); den Rest liefert
 * der nächste `GET /api/board`.
 */
export interface ApiWithId {
  id: string;
}

export interface ApiComment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  createdAt: string;
}

export interface ApiNote {
  id: string;
  kind: 'frage' | 'review';
  noteState: 'offen' | 'erledigt' | 'freigegeben';
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  comments: ApiComment[];
}

export interface ApiChecklistItem {
  id: string;
  orderId: string;
  label: string;
  done: boolean;
  position: number;
  /** 'vorlage' = Pflichtpunkt (nicht löschbar) | 'manuell' = am Auftrag ergänzt. */
  herkunft: 'vorlage' | 'manuell';
}

export interface ApiBoardOrder {
  id: string;
  orderNumber: number;
  creationYear?: number;
  ordertype: string;
  name: string;
  /** DATEV completion_status (Rohwert) — der Board-Feinstatus steht in `boardStatus`. */
  status: string;
  clientId: string;
  clientName?: string;
  clientNumber?: string;
  responsibleId?: string;
  partnerId?: string;
  isInternal: boolean;
  plannedHours: number;
  assessmentYear?: number;
  billingStatus?: string;
  plannedStart?: string;
  plannedEnd?: string;
  boardStatus?: string;
  umplanungenVerbraucht: number;
  responsibleName?: string;
  partnerName?: string;
  /** Teilaufträge (DATEV suborders, via expand mitgeladen) — nur bei Ordertypes mit Rhythmus. */
  suborders?: ApiSuborder[];
  times: ApiTimeEntry[];
  notes: ApiNote[];
  checklist: ApiChecklistItem[];
}

export interface ApiSuborder {
  /** Echte DATEV-Teilauftrags-ID (für die spätere Rückschreibung; Review P1-2). */
  id?: string;
  number: number;
  name: string;
  periodFrom?: string;
  periodTo?: string;
  plannedHours?: number;
  /** DATEV date_work_completed — gesetzt = abgeschlossen. */
  dateWorkCompleted?: string;
}
