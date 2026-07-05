import type { FastifyInstance } from 'fastify';
import type { DatevPort } from '../domain/ports';

export function healthRoutes(app: FastifyInstance, datev: DatevPort): void {
  app.get('/api/health', async () => ({ status: 'ok' }));
  app.get('/api/health/datev', async () => ({ datev: await datev.health() }));
}
