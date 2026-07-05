import type { PublicUser, OrderOverlay, StatusChange, StatusId } from '../types';
import { STATUS_IDS } from '../types';
import type { Repositories } from '../ports';
import type { Clock } from '../clock';
import type { RequireVisibleOrder } from './access';
import { DomainError } from '../errors';
import { canCompleteOrder } from '../rules';

function isStatusId(v: string): v is StatusId {
  return (STATUS_IDS as string[]).includes(v);
}

/**
 * Status-/Board-Aktionen. Statuswechsel laeuft auf zwei Wegen (Drag&Drop + Status-Leiste),
 * beide landen hier. "Erledigt" (er) ist gesperrt, solange die Checkliste nicht vollstaendig ist
 * (canComplete) — dieselbe Regel wie im Frontend, hier serverseitig verbindlich.
 * Jeder Wechsel schreibt einen Eintrag in die Status-Historie (Basis fuer den DATEV-Writeback).
 */
export function createStatusActions(repos: Repositories, clock: Clock, requireVisibleOrder: RequireVisibleOrder) {
  return {
    async setStatus(
      actor: PublicUser,
      orderId: string,
      toStatus: string,
      boardPosition?: number
    ): Promise<OrderOverlay> {
      // Nur sichtbare/zugewiesene Auftraege umschalten (Review-Befund 2).
      await requireVisibleOrder(actor, orderId);
      if (!isStatusId(toStatus)) throw new DomainError('invalid', `unbekannter Status: ${toStatus}`);

      const current = await repos.overlays.get(orderId);
      const fromStatus = current?.boardStatus;

      if (toStatus === 'er') {
        const items = await repos.checklists.listByOrder(orderId);
        if (!canCompleteOrder(items)) {
          throw new DomainError('conflict', 'Checkliste ist noch nicht vollstaendig');
        }
      }

      const overlay: OrderOverlay = {
        orderId,
        boardStatus: toStatus,
        boardPosition: boardPosition ?? current?.boardPosition,
        umplanungenVerbraucht: current?.umplanungenVerbraucht ?? 0,
      };
      await repos.overlays.upsert(overlay);

      // Nur echte Statuswechsel historisieren (reine Positionsverschiebung ist kein Wechsel).
      if (fromStatus !== toStatus) {
        const change: StatusChange = {
          id: clock.newId(),
          orderId,
          fromStatus,
          toStatus,
          actorId: actor.id,
          createdAt: clock.now(),
        };
        await repos.statusHistory.insert(change);
      }
      return overlay;
    },

    async history(actor: PublicUser, orderId: string): Promise<StatusChange[]> {
      // Historie (Akteure/Zeitpunkte) nur fuer sichtbare Auftraege (Review-Befund 3).
      await requireVisibleOrder(actor, orderId);
      return repos.statusHistory.listByOrder(orderId);
    },
  };
}

export type StatusActions = ReturnType<typeof createStatusActions>;
