import type { Repositories, DatevPort } from '../ports';
import type { PublicUser, OrderView, TimeEntry, ChecklistItem, Role } from '../types';
import { visibleOrders } from '../visibility';

/**
 * Board-Aggregat: alles, was das Frontend fuer einen Auftrag anzeigt, in EINER Antwort —
 * DATEV-Stammdaten plus App-Zusatzdaten (Overlay, Zeiten, Notes, Checkliste) plus aufgeloeste
 * Anzeige-Namen. Sichtbarkeit wie GET /api/orders (visibleOrders); die IDs bleiben enthalten,
 * damit das Frontend nicht auf Namens-Vergleiche angewiesen ist.
 */

export interface BoardComment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  createdAt: string;
}

export interface BoardNote {
  id: string;
  kind: 'frage' | 'review';
  noteState: 'offen' | 'erledigt' | 'freigegeben';
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  comments: BoardComment[];
}

export interface BoardOrder extends OrderView {
  /** App-Feinstatus des Kanban-Boards (Overlay); ohne Overlay noch ungesetzt. */
  boardStatus?: string;
  umplanungenVerbraucht: number;
  responsibleName?: string;
  partnerName?: string;
  times: TimeEntry[];
  notes: BoardNote[];
  checklist: ChecklistItem[];
}

export function createBoardActions(repos: Repositories, datev: DatevPort) {
  return {
    async list(actor: PublicUser): Promise<BoardOrder[]> {
      // getClients() ist adapterseitig gecacht (10 Min.) — der Namens-Lookup verteuert den
      // Board-Aufruf also nur beim ersten Mal. Faellt der Stammdaten-Abruf aus, bleibt das
      // Board nutzbar (Frontend zeigt dann die clientId) — deshalb catch -> leere Liste.
      const [orders, users, overlays, clients] = await Promise.all([
        datev.getOrders(),
        repos.users.list(),
        repos.overlays.list(),
        datev.getClients().catch(() => []),
      ]);
      const clientById = new Map(clients.map((c) => [c.id, c]));
      const visible = visibleOrders(orders, actor);
      // Note-/Kommentar-Autoren tragen die APP-User-ID (authorId); Auftrags-Bearbeiter/-Partner
      // dagegen die DATEV-Mitarbeiter-ID (responsibleId/partnerId). Deshalb zwei getrennte Lookups.
      const userById = new Map(users.map((u) => [u.id, u]));
      const nameByAppId = (id?: string) => (id ? userById.get(id)?.name : undefined);
      const nameByDatevId = new Map(users.filter((u) => u.datevEmployeeId).map((u) => [u.datevEmployeeId as string, u.name]));
      const nameByDatev = (id?: string) => (id ? nameByDatevId.get(id) : undefined);
      const overlayByOrder = new Map(overlays.map((o) => [o.orderId, o]));

      return Promise.all(
        visible.map(async (o) => {
          const [times, notes, checklist] = await Promise.all([
            repos.times.listByOrder(o.id),
            repos.notes.listByOrder(o.id),
            repos.checklists.listByOrder(o.id),
          ]);
          const noteDtos: BoardNote[] = await Promise.all(
            notes.map(async (n) => ({
              id: n.id,
              kind: n.kind,
              noteState: n.noteState,
              text: n.text,
              authorId: n.authorId,
              authorName: nameByAppId(n.authorId) ?? n.authorId,
              createdAt: n.createdAt,
              comments: (await repos.notes.listComments(n.id)).map((c) => ({
                id: c.id,
                text: c.text,
                authorId: c.authorId,
                authorName: nameByAppId(c.authorId) ?? c.authorId,
                authorRole: userById.get(c.authorId)?.role ?? 'mitarbeiter',
                createdAt: c.createdAt,
              })),
            })),
          );
          const overlay = overlayByOrder.get(o.id);
          const client = clientById.get(o.clientId);
          return {
            ...o,
            // Mandanten-Klarname aus den Master Data — der Mock traegt ihn bereits am Auftrag.
            clientName: o.clientName ?? client?.name,
            clientNumber: o.clientNumber ?? client?.number,
            boardStatus: overlay?.boardStatus,
            umplanungenVerbraucht: overlay?.umplanungenVerbraucht ?? 0,
            responsibleName: nameByDatev(o.responsibleId),
            partnerName: nameByDatev(o.partnerId),
            times,
            notes: noteDtos,
            checklist,
          };
        }),
      );
    },
  };
}

export type BoardActions = ReturnType<typeof createBoardActions>;
