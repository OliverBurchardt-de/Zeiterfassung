import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { Config } from './config';
import { type AuthDeps, registerAuth } from './plugins/auth';
import type { DatevPort } from './domain/ports';
import type { Actions } from './domain/actions';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { orderRoutes } from './routes/orders';
import { boardRoutes } from './routes/board';
import { timeRoutes } from './routes/time';
import { noteRoutes } from './routes/notes';
import { statusRoutes } from './routes/status';
import { checklistRoutes } from './routes/checklist';

export interface AppDeps extends AuthDeps {
  datev: DatevPort;
  /** Serverseitige Fach-Aktionen (Zeit/Note/Status) ueber den Repositories. */
  actions: Actions;
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
    authRoutes(instance, deps, {
      secureCookies: config.nodeEnv === 'production',
      sessionTtlMs: config.sessionTtlMs,
    });
    orderRoutes(instance, deps.datev);
    boardRoutes(instance, deps.actions);
    timeRoutes(instance, deps.actions);
    noteRoutes(instance, deps.actions);
    statusRoutes(instance, deps.actions);
    checklistRoutes(instance, deps.actions);
  });

  // Zentrale Fehlerbehandlung (ADR-11): keine internen Details nach aussen — auch bei 4xx nicht
  // (Library-Fehlermeldungen wie Content-Type-Parser koennten Interna verraten; unsere Routen
  // antworten ohnehin direkt mit eigenen Meldungen und laufen nicht durch diesen Handler).
  app.setErrorHandler((err, req, reply) => {
    req.log.error(err);
    const status = err.statusCode ?? 500;
    reply.code(status).send({ error: status >= 500 ? 'interner Fehler' : 'Anfrage fehlgeschlagen' });
  });

  return app;
}
