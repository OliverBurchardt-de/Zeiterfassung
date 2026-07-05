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
  times: ApiTimeEntry[];
  notes: ApiNote[];
  checklist: ApiChecklistItem[];
}
