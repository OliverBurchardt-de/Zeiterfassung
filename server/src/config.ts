export interface Config {
  port: number;
  host: string;
  cookieSecret: string;
  nodeEnv: string;
}

/** Liest die Konfiguration aus Umgebungsvariablen (siehe .env.example). Keine Geheimnisse im Code. */
export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? '0.0.0.0',
    cookieSecret: process.env.COOKIE_SECRET ?? 'dev-insecure-secret-change-me',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  };
}
