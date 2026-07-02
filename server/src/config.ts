export interface Config {
  port: number;
  host: string;
  cookieSecret: string;
  nodeEnv: string;
  /** Session-Lebensdauer in ms (Default 8 h — ein Arbeitstag). */
  sessionTtlMs: number;
}

const DEV_SECRET = 'dev-insecure-secret-change-me';

/**
 * Liest die Konfiguration aus Umgebungsvariablen (siehe .env.example). Keine Geheimnisse im Code.
 * Fail-Fast: In Produktion MUSS COOKIE_SECRET gesetzt sein — sonst liefe die Cookie-Signatur
 * mit einem oeffentlich im Repo einsehbaren Standardwert (ADR-09).
 */
export function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const cookieSecret = process.env.COOKIE_SECRET ?? DEV_SECRET;
  if (nodeEnv === 'production' && cookieSecret === DEV_SECRET) {
    throw new Error('COOKIE_SECRET ist in Produktion nicht gesetzt — Start abgebrochen (siehe .env.example).');
  }
  return {
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? '0.0.0.0',
    cookieSecret,
    nodeEnv,
    sessionTtlMs: Number(process.env.SESSION_TTL_MS ?? 8 * 60 * 60 * 1000),
  };
}
