import type { FastifyReply } from 'fastify';
import { isDomainError, httpStatusFor } from '../domain/errors';

/**
 * Fuehrt eine Domaenen-Aktion aus und uebersetzt einen DomainError in den passenden HTTP-Status
 * (404/403/400/409). Die DomainError-Meldungen sind kuratierte Fachtexte (keine Interna) und
 * duerfen nach aussen. Andere Fehler fliegen weiter zum zentralen Error-Handler (500).
 * Gibt `undefined` zurueck, wenn bereits geantwortet wurde (Aufrufer beendet dann).
 */
export async function runAction<T>(reply: FastifyReply, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (isDomainError(err)) {
      reply.code(httpStatusFor(err.code)).send({ error: err.message });
      return undefined;
    }
    throw err;
  }
}
