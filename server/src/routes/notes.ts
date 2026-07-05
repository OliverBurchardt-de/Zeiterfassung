import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth';
import type { Actions } from '../domain/actions';
import { runAction } from './domainReply';

const TextBody = z.object({ text: z.string().min(1) });

/** Review-Notes/Fragen — Workflow + Rechte in den Aktionen (notePolicy), nicht hier. */
export function noteRoutes(app: FastifyInstance, actions: Actions): void {
  app.get('/api/orders/:orderId/notes', { preHandler: requireAuth }, async (req) => {
    const { orderId } = req.params as { orderId: string };
    return actions.notes.listByOrder(orderId);
  });

  app.post('/api/orders/:orderId/notes', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId } = req.params as { orderId: string };
    const parsed = TextBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ungültige Eingabe' });
    const note = await runAction(reply, () =>
      actions.notes.createNote(req.currentUser!, { orderId, text: parsed.data.text })
    );
    if (!note) return reply;
    return reply.code(201).send(note);
  });

  app.patch('/api/notes/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = TextBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ungültige Eingabe' });
    const note = await runAction(reply, () => actions.notes.editText(req.currentUser!, id, parsed.data.text));
    return note ?? reply;
  });

  app.post('/api/notes/:id/done', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const note = await runAction(reply, () => actions.notes.markDone(req.currentUser!, id));
    return note ?? reply;
  });

  app.post('/api/notes/:id/reopen', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const note = await runAction(reply, () => actions.notes.reopen(req.currentUser!, id));
    return note ?? reply;
  });

  app.post('/api/notes/:id/approve', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const note = await runAction(reply, () => actions.notes.approve(req.currentUser!, id));
    return note ?? reply;
  });

  app.post('/api/notes/:id/comments', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = TextBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ungültige Eingabe' });
    const comment = await runAction(reply, () => actions.notes.comment(req.currentUser!, id, parsed.data.text));
    if (!comment) return reply;
    return reply.code(201).send(comment);
  });

  app.delete('/api/notes/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const done = await runAction(reply, async () => {
      await actions.notes.deleteNote(req.currentUser!, id);
      return { ok: true };
    });
    return done ?? reply;
  });
}
