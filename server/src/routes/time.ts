import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth';
import type { Actions } from '../domain/actions';
import { runAction } from './domainReply';

const BookBody = z.object({
  orderId: z.string().min(1),
  suborderId: z.string().min(1).optional(),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als JJJJ-MM-TT'),
  dauer: z.number().positive(),
  notiz: z.string().optional(),
  aufwandsart: z.enum(['mehraufwand', 'dumm']).optional(),
  idempotencyKey: z.string().min(1).max(100).optional(),
});

/** Zeiterfassung — jeder bucht/aendert nur EIGENE Zeiten (Durchsetzung in den Aktionen). */
export function timeRoutes(app: FastifyInstance, actions: Actions): void {
  app.post('/api/time', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = BookBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ungültige Eingabe' });
    const entry = await runAction(reply, () => actions.time.bookTime(req.currentUser!, parsed.data));
    if (!entry) return reply;
    return reply.code(201).send(entry);
  });

  app.post('/api/time/:id/release', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const entry = await runAction(reply, () => actions.time.releaseTime(req.currentUser!, id));
    return entry ?? reply;
  });

  app.post('/api/time/:id/withdraw', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const entry = await runAction(reply, () => actions.time.withdrawTime(req.currentUser!, id));
    return entry ?? reply;
  });

  app.delete('/api/time/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const done = await runAction(reply, async () => {
      await actions.time.deleteTime(req.currentUser!, id);
      return { ok: true };
    });
    return done ?? reply;
  });
}
