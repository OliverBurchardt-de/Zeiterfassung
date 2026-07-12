import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth';
import type { Actions } from '../domain/actions';
import { LIMITS } from '../domain/limits';
import { runAction } from './domainReply';

const StatusBody = z.object({
  status: z.string().min(1),
  position: z.number().int().min(0).max(LIMITS.BOARD_POSITION_MAX).optional(),
});

/** Board-Status setzen (Drag&Drop + Status-Leiste). */
export function statusRoutes(app: FastifyInstance, actions: Actions): void {
  app.post('/api/orders/:orderId/status', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId } = req.params as { orderId: string };
    const parsed = StatusBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ungültige Eingabe' });
    const overlay = await runAction(reply, () =>
      actions.status.setStatus(req.currentUser!, orderId, parsed.data.status, parsed.data.position)
    );
    return overlay ?? reply;
  });
}
