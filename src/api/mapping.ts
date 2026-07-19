import type { Order, User, StatusId } from '@/lib/types';
import { STATUS_ORDER } from '@/lib/tokens';
import { ordertypeInfo, artKeyForOrdertype } from '@/lib/ordertypes';
import { monatLabel } from '@/lib/monate';
import type { ApiUser, ApiBoardOrder } from './types';

/**
 * Übersetzt Server-DTOs ins Frontend-Modell. Die Ableitungen bleiben bewusst hier im
 * Client (wie beim DATEV-Import beschrieben in CLAUDE.md):
 *  - `art`/`artKey` sind Projektionen aus dem Ordertype (Katalog src/lib/ordertypes.ts),
 *  - der Anzeige-Monat kommt aus dem Planungs-Ende (`plannedEnd`, DATEV planned_end).
 */

/** "O. Burchardt" → "OB" — Anzeige-Kürzel aus dem Namen (Avatar-Chip). */
export function initialenAus(name: string): string {
  const teile = name.split(/\s+/).filter(Boolean);
  const buchstaben = teile.map((t) => t.replace(/[^\p{L}]/gu, '').charAt(0)).filter(Boolean);
  return (buchstaben.join('').toUpperCase() || '?').slice(0, 2);
}

/** Server-Nutzer → Frontend-User. Profifelder (Tagessoll etc.) bis zur Nutzer-API mit Defaults. */
export function mapApiUser(u: ApiUser): User {
  return {
    id: u.id,
    name: u.name,
    initials: initialenAus(u.name),
    email: u.username, // Login-Kennung; echte E-Mail kommt mit der Nutzer-API (Etappe 3)
    role: u.role,
    admin: u.admin,
    aktiv: true,
    datevId: u.datevEmployeeId ?? '',
    tagessoll: 8,
    arbeitstageProWoche: 5,
    kvLimitMin: u.kvLimitMin,
  };
}

/** Board-Feinstatus des Servers (Overlay) → StatusId; ohne/mit unbekanntem Wert: Arbeitsvorrat. */
function statusOf(dto: ApiBoardOrder): StatusId {
  const s = dto.boardStatus ?? '';
  return (STATUS_ORDER as string[]).includes(s) ? (s as StatusId) : 'av';
}

/** ISO-Datum → Anzeige-Monat ("2026-03-31" → "Mär 2026"); leer, wenn ungeplant. */
function monatAus(iso?: string): string {
  if (!iso) return '';
  const year = Number(iso.slice(0, 4));
  const monthIndex = Number(iso.slice(5, 7)) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return '';
  return monatLabel(year, monthIndex);
}

export function mapBoardOrder(dto: ApiBoardOrder): Order {
  const info = ordertypeInfo(dto.ordertype);
  return {
    id: dto.id,
    mandant: dto.clientName ?? dto.clientId,
    mandantNr: dto.clientNumber ?? dto.clientId,
    auftragsNr: dto.creationYear ? `${dto.orderNumber}/${dto.creationYear}` : String(dto.orderNumber),
    ordertype: dto.ordertype,
    art: info?.name ?? dto.name,
    artKey: artKeyForOrdertype(dto.ordertype, info?.groupId ?? -1) ?? 'beratung',
    vj: dto.assessmentYear ?? dto.creationYear ?? 0,
    fristStart: dto.plannedStart ?? '',
    fristEnde: dto.plannedEnd ?? '',
    monat: monatAus(dto.plannedEnd),
    soll: dto.plannedHours,
    seiten: 0, // Ist-Seiten/-Kosten liefert erst der DATEV-Kostenabruf (spaeterer M2-Schritt)
    kosten: 0,
    status: statusOf(dto),
    fakturiert: (dto.billingStatus ?? '').toLowerCase() === 'invoiced',
    bearbeiter: dto.responsibleName ?? '',
    bearbeiterId: dto.responsibleId ?? '',
    partner: dto.partnerName ?? '',
    checklist: dto.checklist.map((c) => ({ id: c.id, label: c.label, done: c.done, herkunft: c.herkunft })),
    // Teilaufträge: Monat aus dem Leistungszeitraum (period_from), erledigt = date_work_completed.
    suborders: dto.suborders?.map((s) => ({
      id: String(s.number),
      datevId: s.id,
      monat: monatAus(s.periodFrom ?? s.periodTo) || s.name,
      soll: s.plannedHours ?? 0,
      erfasst: 0, // Ist je Teilauftrag liefert erst der DATEV-Kostenabruf (späterer Schritt)
      erledigtAm: s.dateWorkCompleted,
    })),
    notes: dto.notes.map((n) => ({
      id: n.id,
      text: n.text,
      author: n.authorName,
      kind: n.kind,
      noteState: n.noteState,
      comments: n.comments.map((c) => ({ id: c.id, text: c.text, author: c.authorName, role: c.authorRole })),
      attachments: [], // Datei-Anhänge kommen mit der Attachment-API (Etappe 3)
    })),
    times: dto.times.map((t) => ({
      id: t.id,
      userId: t.userId, // Ownership: Basis für „Meine Zeiten" + Freigeben/Löschen (Codex P2)
      datum: t.datum,
      dauer: t.dauer,
      status: t.status,
      notiz: t.notiz,
      aufwandsart: t.aufwandsart,
    })),
    umplanung: null, // Umplanungs-Workflow serverseitig in Etappe 3
    umplanungenVerbraucht: dto.umplanungenVerbraucht,
  };
}
