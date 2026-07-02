/** DATEVconnect-Zugang. `mode: 'mock'` = Schein-Adapter (ohne Netz); `'http'` = echter Adapter. */
export interface DatevConfig {
  mode: 'mock' | 'http';
  /** z. B. http://localhost:58454/datev/api oder https://<hostname>:58452/datev/api */
  baseUrl: string;
  /** 'basic' = technischer Benutzer (Dauerbetrieb); 'none' = integrierte Windows-Anmeldung (nur auf dem ASP-Server). */
  auth: 'basic' | 'none';
  user: string;
  password: string;
  /** Optionaler OData-Filter für getOrders, z. B. "creation_year eq 2026" (gegen ~7.500 Aufträge). */
  ordersFilter: string;
}

export interface Config {
  port: number;
  host: string;
  cookieSecret: string;
  nodeEnv: string;
  /** Session-Lebensdauer in ms (Default 8 h — ein Arbeitstag). */
  sessionTtlMs: number;
  datev: DatevConfig;
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

  const datevMode = (process.env.DATEV_MODE ?? 'mock') === 'http' ? 'http' : 'mock';
  const datevAuth = (process.env.DATEV_AUTH ?? 'basic') === 'none' ? 'none' : 'basic';
  const datevUser = process.env.DATEV_USER ?? '';
  const datevPassword = process.env.DATEV_PASSWORD ?? '';
  // Fail-Fast: echter Zugriff per Basic Auth ohne Zugangsdaten wuerde nur 401 liefern.
  if (datevMode === 'http' && datevAuth === 'basic' && (!datevUser || !datevPassword)) {
    throw new Error('DATEV_MODE=http mit Basic Auth verlangt DATEV_USER und DATEV_PASSWORD (siehe .env.example).');
  }

  return {
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? '0.0.0.0',
    cookieSecret,
    nodeEnv,
    sessionTtlMs: Number(process.env.SESSION_TTL_MS ?? 8 * 60 * 60 * 1000),
    datev: {
      mode: datevMode,
      baseUrl: process.env.DATEV_BASE_URL ?? 'http://localhost:58454/datev/api',
      auth: datevAuth,
      user: datevUser,
      password: datevPassword,
      ordersFilter: process.env.DATEV_ORDERS_FILTER ?? '',
    },
  };
}
