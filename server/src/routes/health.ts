import type { FastifyInstance } from 'fastify';
import type { DatevPort } from '../domain/ports';
import { requireAuth } from '../plugins/auth';

export function healthRoutes(app: FastifyInstance, datev: DatevPort): void {
  // Billiger, oeffentlicher Liveness-Check (kein DATEV-Aufruf) — fuer Loadbalancer/Monitoring.
  app.get('/api/health', async () => ({ status: 'ok' }));
  // Tiefer DATEV-Check loest einen echten Remote-Aufruf aus -> nur fuer angemeldete Nutzer
  // (Review P2-7): sonst koennte jeder anonym DATEV-Last ausloesen bzw. den Zustand abfragen.
  app.get('/api/health/datev', { preHandler: requireAuth }, async () => ({ datev: await datev.health() }));
}
