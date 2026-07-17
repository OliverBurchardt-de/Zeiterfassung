import 'dotenv/config'; // laedt .env (lokale Zugangsdaten; nicht im Repo)

/** DATEVconnect-Zugang. `mode: 'mock'` = Schein-Adapter (ohne Netz); `'http'` = echter Adapter. */
export interface DatevConfig {
  mode: 'mock' | 'http';
  /** z. B. http://localhost:58454/datev/api oder https://<hostname>:58452/datev/api */
  baseUrl: string;
  /**
   * 'basic' = technischer Benutzer (Dauerbetrieb, Produktion);
   * 'ntlm'  = Windows-Domänenkonto "DOMAIN\benutzer" (Entwicklungsumgebung — verifizierter Weg
   *           von außerhalb des ASP, s. docs/datev-connect-handoff.md §12);
   * 'none'  = integrierte Windows-Anmeldung (nur auf dem ASP-Server selbst).
   */
  auth: 'basic' | 'ntlm' | 'none';
  user: string;
  password: string;
  /** Optionaler OData-Filter für getOrders, z. B. "creation_year eq 2026" (gegen ~7.500 Aufträge). */
  ordersFilter: string;
  /** Hartes Timeout je DATEV-Aufruf in ms (Review P2-7): ein haengender Dienst bindet keine Requests. */
  timeoutMs: number;
  /**
   * NUR Entwicklung: Zertifikatsprüfung aus (Zugriff über IP → Zertifikatsname passt nicht).
   * In Produktion verboten (Fail-Fast) — dort über den DNS-Hostnamen zugreifen.
   */
  tlsInsecure: boolean;
}

/** MS-SQL-Zugang. `mode: 'memory'` = In-Memory-Repos (ohne DB); `'mssql'` = echte Datenbank. */
export interface DbConfig {
  mode: 'memory' | 'mssql';
  host: string;
  port: number;
  /** Benannte Instanz (z. B. 'SQLEXPRESS' bei SQL Server Express); wenn gesetzt, gilt sie statt des Ports. */
  instanceName: string;
  database: string;
  user: string;
  password: string;
  /** Transportverschluesselung (bei Server im gleichen Netz oft mit selbstsigniertem Zertifikat). */
  encrypt: boolean;
  trustServerCertificate: boolean;
}

/**
 * Automatische Synchronisierung (docs/synchronisierung-konzept.md). Steuert den nächtlichen
 * Lese-Sync (DATEV → Snapshot) und den Outbox-Arbeiter (App → DATEV). Standard: an im
 * Echtdaten-Modus (DATEV_MODE=http), aus im Mock/Demo-Modus.
 */
export interface SyncConfig {
  /** Lese-Sync + Lese-Weiche aktiv (Board liest aus dem Snapshot statt live). */
  enabled: boolean;
  /** Uhrzeit des nächtlichen Voll-Laufs im 24-h-Format "HH:MM". */
  nightlyAt: string;
  /** Abstand des Delta-Laufs in Minuten; 0 = kein Delta-Lauf. */
  deltaEveryMin: number;
  /** Outbox-Arbeiter aktiv (Rückschreibung nach DATEV). */
  outboxEnabled: boolean;
  /** Abstand, in dem die Outbox-Warteschlange abgearbeitet wird (Minuten). */
  outboxEveryMin: number;
}

export interface Config {
  port: number;
  host: string;
  cookieSecret: string;
  nodeEnv: string;
  /** Session-Lebensdauer in ms (Default 8 h — ein Arbeitstag). */
  sessionTtlMs: number;
  /**
   * Fastify trustProxy (Review P2-9): hinter einem Reverse Proxy muss der App-Server wissen, welchem
   * Proxy er den X-Forwarded-For-Header glauben darf, damit `req.ip` die echte Client-IP ist (Basis
   * des IP-Login-Schutzes). `false` = kein Proxy (Direktbetrieb). Sonst eine konkrete Proxy-Adresse
   * bzw. Liste — bewusst KEINE pauschale Vertrauensstellung beliebiger Header.
   */
  trustProxy: boolean | string;
  datev: DatevConfig;
  db: DbConfig;
  sync: SyncConfig;
}

/** Positive, endliche Ganzzahl aus einer Umgebungsvariable (Review P3-2): sonst Fail-Fast. */
function posInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} muss eine positive Ganzzahl sein, war: "${raw}".`);
  }
  return n;
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
  const authRaw = process.env.DATEV_AUTH ?? 'basic';
  const datevAuth: 'basic' | 'ntlm' | 'none' =
    authRaw === 'ntlm' ? 'ntlm' : authRaw === 'none' ? 'none' : 'basic';
  const datevUser = process.env.DATEV_USER ?? '';
  const datevPassword = process.env.DATEV_PASSWORD ?? '';
  // Fail-Fast: echter Zugriff mit Anmeldung, aber ohne Zugangsdaten, wuerde nur 401 liefern.
  if (datevMode === 'http' && datevAuth !== 'none' && (!datevUser || !datevPassword)) {
    throw new Error(`DATEV_MODE=http mit ${datevAuth} verlangt DATEV_USER und DATEV_PASSWORD (siehe .env.example).`);
  }
  const tlsInsecure = (process.env.DATEV_TLS_INSECURE ?? 'false') === 'true';
  if (tlsInsecure && nodeEnv === 'production') {
    throw new Error('DATEV_TLS_INSECURE ist in Produktion verboten — DNS-Hostnamen verwenden (Handoff §12).');
  }

  const dbMode = (process.env.DB_MODE ?? 'memory') === 'mssql' ? 'mssql' : 'memory';
  // Fail-Fast: Memory-Modus seedet fest verdrahtete Demo-Nutzer (burchardt/demo = Admin) und
  // verliert alle Daten beim Neustart — in Produktion waere das ein offener Admin-Login auf
  // echte DATEV-Auftraege (Codex-Review P1). Produktion verlangt deshalb immer DB_MODE=mssql.
  if (nodeEnv === 'production' && dbMode !== 'mssql') {
    throw new Error('DB_MODE=memory (Demo-Nutzer!) ist in Produktion verboten — DB_MODE=mssql setzen (siehe .env.example).');
  }
  const dbUser = process.env.DB_USER ?? '';
  const dbPassword = process.env.DB_PASSWORD ?? '';
  // Fail-Fast: echte DB ohne Zugangsdaten wuerde nur Login-Fehler produzieren.
  if (dbMode === 'mssql' && (!process.env.DB_HOST || !dbUser || !dbPassword)) {
    throw new Error('DB_MODE=mssql verlangt DB_HOST, DB_USER und DB_PASSWORD (siehe .env.example).');
  }

  // Sync standardmaessig an im Echtdaten-Modus, aus im Mock/Demo-Modus (dort gibt es nichts zu
  // spiegeln). Einzeln per Umgebungsvariable uebersteuerbar.
  const syncDefault = datevMode === 'http';
  const nightlyAt = process.env.SYNC_NIGHTLY_AT ?? '05:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(nightlyAt)) {
    throw new Error(`SYNC_NIGHTLY_AT muss "HH:MM" (24-h) sein, war: "${nightlyAt}".`);
  }
  const sync: SyncConfig = {
    enabled: (process.env.SYNC_ENABLED ?? String(syncDefault)) === 'true',
    nightlyAt,
    deltaEveryMin: Math.max(0, Number(process.env.SYNC_DELTA_EVERY_MIN ?? 0)),
    outboxEnabled: (process.env.SYNC_OUTBOX_ENABLED ?? String(syncDefault)) === 'true',
    outboxEveryMin: Math.max(1, Number(process.env.SYNC_OUTBOX_EVERY_MIN ?? 5)),
  };

  // trustProxy: leer/'false' = kein Proxy; 'true' = erster Hop; sonst konkrete Adresse/Liste.
  const trustProxyRaw = process.env.TRUST_PROXY ?? '';
  const trustProxy: boolean | string =
    trustProxyRaw === '' || trustProxyRaw === 'false' ? false : trustProxyRaw === 'true' ? true : trustProxyRaw;

  return {
    port: posInt('PORT', process.env.PORT, 3001),
    host: process.env.HOST ?? '0.0.0.0',
    cookieSecret,
    nodeEnv,
    sessionTtlMs: posInt('SESSION_TTL_MS', process.env.SESSION_TTL_MS, 8 * 60 * 60 * 1000),
    trustProxy,
    datev: {
      mode: datevMode,
      baseUrl: process.env.DATEV_BASE_URL ?? 'http://localhost:58454/datev/api',
      auth: datevAuth,
      user: datevUser,
      password: datevPassword,
      ordersFilter: process.env.DATEV_ORDERS_FILTER ?? '',
      timeoutMs: posInt('DATEV_TIMEOUT_MS', process.env.DATEV_TIMEOUT_MS, 30_000),
      tlsInsecure,
    },
    db: {
      mode: dbMode,
      host: process.env.DB_HOST ?? 'localhost',
      port: posInt('DB_PORT', process.env.DB_PORT, 1433),
      instanceName: process.env.DB_INSTANCE ?? '',
      database: process.env.DB_NAME ?? 'Zeiterfassung',
      user: dbUser,
      password: dbPassword,
      encrypt: (process.env.DB_ENCRYPT ?? 'true') !== 'false',
      trustServerCertificate: (process.env.DB_TRUST_CERT ?? 'true') !== 'false',
    },
    sync,
  };
}
