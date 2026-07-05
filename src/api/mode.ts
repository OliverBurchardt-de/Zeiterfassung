/**
 * Betriebsart des Frontends:
 *  - Demo-Modus (Default): Mock-Daten im Browser, Mock-Login — wie bisher (`npm run dev`).
 *  - Server-Modus: echter Login + Daten über die REST-API (`npm run dev:api`; setzt
 *    VITE_API_MODE=server über `.env.api`). Die Anfragen laufen über den Vite-Proxy
 *    auf http://localhost:3001 (same-origin → Session-Cookie funktioniert ohne CORS).
 *
 * Bewusst ein eigenes Mini-Modul ohne Abhängigkeiten, damit Store UND API-Schicht es
 * importieren können, ohne einen Import-Kreis zu bilden.
 */
export const API_MODE = import.meta.env.VITE_API_MODE === 'server';
