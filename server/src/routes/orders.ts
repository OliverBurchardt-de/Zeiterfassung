import type { FastifyInstance } from 'fastify';
import type { DatevPort } from '../domain/ports';
import { requireAuth } from '../plugins/auth';
import { visibleOrders } from '../domain/visibility';

/**
 * Beispielhafter, end-to-end abgesicherter Lese-Endpunkt: holt Auftraege ueber den
 * DATEV-Adapter und filtert sie serverseitig nach Sichtbarkeit (Rolle/Zuordnung).
 */
export function orderRoutes(app: FastifyInstance, datev: DatevPort): void {
  app.get('/api/orders', { preHandler: requireAuth }, async (req) => {
    const all = await datev.getOrders();
    return visibleOrders(all, req.currentUser!);
  });
}
