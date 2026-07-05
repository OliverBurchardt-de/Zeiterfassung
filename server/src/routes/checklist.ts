import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth';
import type { Actions } from '../domain/actions';
import { runAction } from './domainReply';

const AddBody = z.object({ label: z.string().min(1) });
const DoneBody = z.object({ done: z.boolean() });
const EnsureBody = z.object({ labels: z.array(z.string()).max(200) });

/** Checkliste je Auftrag — Sichtbarkeit/Regeln in den Aktionen, nicht hier. Lesen via GET /api/board. */
export function checklistRoutes(app: FastifyInstance, actions: Actions): void {
  app.post('/api/orders/:orderId/checklist/ensure', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId } = req.params as { orderId: string };
    const parsed = EnsureBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ungültige Eingabe' });
    const items = await runAction(reply, () => actions.checklist.ensure(req.currentUser!, orderId, parsed.data.labels));
    return items ?? reply;
  });

  app.post('/api/orders/:orderId/checklist', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId } = req.params as { orderId: string };
    const parsed = AddBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ungültige Eingabe' });
    const item = await runAction(reply, () => actions.checklist.add(req.currentUser!, orderId, parsed.data.label));
    if (!item) return reply;
    return reply.code(201).send(item);
  });

  app.post('/api/orders/:orderId/checklist/:itemId/done', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId, itemId } = req.params as { orderId: string; itemId: string };
    const parsed = DoneBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ungültige Eingabe' });
    const item = await runAction(reply, () =>
      actions.checklist.setDone(req.currentUser!, orderId, itemId, parsed.data.done)
    );
    return item ?? reply;
  });

  app.delete('/api/orders/:orderId/checklist/:itemId', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId, itemId } = req.params as { orderId: string; itemId: string };
    const done = await runAction(reply, async () => {
      await actions.checklist.remove(req.currentUser!, orderId, itemId);
      return { ok: true };
    });
    return done ?? reply;
  });
}
