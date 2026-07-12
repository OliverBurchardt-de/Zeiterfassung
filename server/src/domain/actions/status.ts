import type { PublicUser, OrderOverlay, StatusChange, StatusId } from '../types';
import { STATUS_IDS } from '../types';
import type { Repositories } from '../ports';
import type { Clock } from '../clock';
import type { RequireVisibleOrder } from './access';
import { DomainError } from '../errors';
import { canCompleteOrder } from '../rules';
import { LIMITS } from '../limits';
import { defaultChecklistLabels } from '../checklistTemplates';
import { seedChecklist } from './checklist';

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
      const order = await requireVisibleOrder(actor, orderId);
      if (!isStatusId(toStatus)) throw new DomainError('invalid', `unbekannter Status: ${toStatus}`);
      // Board-Position: nicht negativ, ganzzahlig, grosszuegig gedeckelt (Review P2.4).
      if (
        boardPosition !== undefined &&
        (!Number.isInteger(boardPosition) || boardPosition < 0 || boardPosition > LIMITS.BOARD_POSITION_MAX)
      ) {
        throw new DomainError('invalid', 'ungueltige Board-Position');
      }

      const current = await repos.overlays.get(orderId);
      const fromStatus = current?.boardStatus;

      if (toStatus === 'er') {
        // Pflicht-Checkliste VOR der Gate-Pruefung sicherstellen: ohne dies waere „Erledigt"
        // per Board-Drag/API-Aufruf moeglich, bevor die Checkliste je instanziiert wurde —
        // eine leere Liste gilt als vollstaendig (Codex-Review P2). Idempotent: existieren
        // bereits Punkte (Client-`ensure` beim ersten Oeffnen), passiert hier nichts.
        const items = await seedChecklist(repos, clock, orderId, defaultChecklistLabels(order.ordertype));
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
      // Nur echte Statuswechsel historisieren (reine Positionsverschiebung ist kein Wechsel).
      const change: StatusChange | undefined =
        fromStatus !== toStatus
          ? { id: clock.newId(), orderId, fromStatus, toStatus, actorId: actor.id, createdAt: clock.now() }
          : undefined;
      // Atomar (Review P2.6): Overlay + Historie zusammen — MSSQL in einer Transaktion; der
      // spaetere DATEV-Outbox-Eintrag (Sync-Job) kommt als dritter Teilnehmer dazu.
      await repos.statusTransaktion.commitStatusWechsel(overlay, change);
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
