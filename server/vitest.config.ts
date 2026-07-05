import { defineConfig } from 'vitest/config';

// Eigene Vitest-Konfiguration fuer das Server-Paket. Ohne sie wandert `vitest run` aus `server/`
// die Verzeichnisse hoch und liest die Frontend-Root-`vitest.config.ts` ein — die importiert
// `vitest/config` und setzt `jsdom` + `include: src/**` + den `@`-Alias. In der CI ist im
// isolierten `server`-Job nur `server/node_modules` installiert, weshalb das Laden der Root-Config
// mit `Cannot find package 'vitest'` abbricht. Diese Datei haelt die Suche im Server-Paket und
// stellt die richtige Umgebung (Node, relative Imports) ein.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
