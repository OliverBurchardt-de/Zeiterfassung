import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { Config } from './config';
import { type AuthDeps, registerAuth } from './plugins/auth';
import type { DatevPort } from './domain/ports';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { orderRoutes } from './routes/orders';

export interface AppDeps extends AuthDeps {
  datev: DatevPort;
}

/**
 * Baut die Fastify-App per Dependency Injection zusammen (ADR-10: alles ohne echtes
 * DATEV/DB testbar). API-Schicht ruft Domain/Adapter — Trennung gemaess ADR-01.
 */
export function buildApp(config: Config, deps: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: config.nodeEnv !== 'test',
  });

  app.register(cookie, { secret: config.cookieSecret });

  app.register(async (instance) => {
    registerAuth(instance, deps);
    healthRoutes(instance, deps.datev);
    authRoutes(instance, deps);
    orderRoutes(instance, deps.datev);
  });

  // Zentrale Fehlerbehandlung (ADR-11): keine internen Details nach aussen.
  app.setErrorHandler((err, req, reply) => {
    req.log.error(err);
    const status = err.statusCode ?? 500;
    reply.code(status).send({ error: status >= 500 ? 'interner Fehler' : err.message });
  });

  return app;
}
