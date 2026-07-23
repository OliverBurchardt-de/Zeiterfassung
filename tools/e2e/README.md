# E2E-Prüfläufe (Playwright, manuell gestartet)

Reproduzierbare End-to-End-Suiten für den **Server-Modus** (und eine Demo-Regression).
Sie sind bewusst **kein CI-Bestandteil**: sie brauchen laufende Prozesse (Server + Vite)
und einen Browser — dafür prüfen sie die App durchgehend wie ein echter Benutzer.

| Suite | prüft |
|---|---|
| `e2e-server-writes.mjs` | Login, Zeit buchen/freigeben/zurückziehen/löschen, Notiz, Statuswechsel — je über Reload persistiert |
| `e2e-server-error.mjs` | Fehlerpfad: Server-Ablehnung → Sync-Banner + Zurückrollen des optimistischen Updates |
| `e2e-checklist.mjs` | Checkliste: idempotentes Seeding, „Erledigt"-Gate, Abhaken/Hinzufügen/Entfernen persistiert |
| `e2e-codexfixes.mjs` | Codex-Review-Fixes: echtes Arbeitsdatum, Zeit-Ownership, Gate-Seed, Planungs-IDs |
| `e2e-demo-regression.mjs` | Demo-Modus unverändert (Mock-Daten, HEUTE-Stichtag) |
| `e2e-verhalten.mjs` | Auftragsart-Behandlung (Demo, Port 5173): Board nur planbar, Filterleiste ohne leere Buckets, Sektion „Sonstige Aufträge" buchbar + Suche |
| `e2e-teilauftrag.mjs` | Server-Modus: Karte zeigt NUR den nächsten offenen Teilauftrag + Mandanten-Klarname |
| `e2e-zeiterfassung.mjs` | Zeiterfassungs-Board (Demo, Port 5173): Tagesauswahl, Palette-Suche, Drag&Drop → Entwurf → buchen, Tagessumme, Tageswechsel |
| `e2e-interne-limits.mjs` | Kanzleiverwaltung bebuchbar + Tageslimit-Hinweis (kein hartes Limit); Backoffice-Rolle bucht für andere (Demo, Port 5173) |
| `e2e-aufgaben.mjs` | Modul „Aufgaben" (Demo, Port 5173): Badge, zugewiesene/überfällige Aufgaben, Anlegen, Abhaken, „Von mir vergeben", To-Do-Bereich im Auftrag |
| `e2e-stoppuhr.mjs` | Zeiterfassungs-Board (Demo, Port 5173): Stoppuhr starten, Live-Tick, Reload-fest, Stopp&buchen → Block, Wechsel bucht laufenden Auftrag, Verwerfen ohne Buchung |

## Ausführen

Voraussetzungen: einmalig `npm install playwright` (z. B. in einem Arbeitsordner) und ein
Chromium (`npx playwright install chromium`, falls keins vorhanden).

```bash
# Terminal 1: Server frisch starten (Memory-Modus)
cd server && npm run dev

# Terminal 2: Frontend im Server-Modus
npm run dev:api

# Terminal 3: Suite ausführen
node tools/e2e/e2e-server-writes.mjs
```

Umgebungsvariablen (optional):
- `E2E_OUT` — Zielordner für Screenshots (Default: aktueller Ordner)
- `CHROMIUM` — Pfad zu einer vorhandenen Chromium-Binärdatei (Default: Playwright-eigener Browser)

Jede Suite schreibt `OK:`/`FEHLER:`-Zeilen und endet mit Exit-Code ≠ 0 bei Fehlschlägen.
Für Suiten, die Daten anlegen, den Memory-Server vorher **neu starten** (frischer Zustand).
`e2e-demo-regression.mjs` läuft gegen `npm run dev` (Demo-Modus, Port 5173) statt `dev:api`.
