# Backend (M2) — Zeiterfassung & Auftragsabwicklung

Server der App: REST-API, eigener Login, eigene Persistenz, DATEV-Adapter. Architektur-Grundlage:
`../docs/architektur-entscheidungen.md` (ADRs), Fahrplan: `../docs/m2-plan.md`.

> **Stand:** Default läuft gegen **In-Memory**-Daten und einen **Schein-DATEV-Adapter**
> (ohne Datenbank/DATEV lauffähig und testbar). Zuschaltbar sind der **echte
> DATEVconnect-Adapter** (`DATEV_MODE=http`) und die **MS-SQL-Persistenz** (`DB_MODE=mssql`;
> **alle** Fach-Repositories) — `buildApp` bleibt gleich. Die **Fach-Aktionen + API-Routen**
> für Zeit, Note, Status und Checkliste tragen das serverseitig verbindliche Rollen-/
> Workflow-Gating (inkl. „Erledigt"-Checklisten-Gate mit Vorlagen-Seed). Gelesen wird über
> **`GET /api/board`** (komplettes Auftrags-Aggregat in einer Antwort). Das Frontend nutzt
> all das im **Server-Modus** (`npm run dev:api` im Projekt-Root): echter Login, Board lesen
> und **alle Schreib-Aktionen serverseitig festgeschrieben** (Etappen 1–3-Checklisten,
> siehe `../CLAUDE.md`). Als Nächstes: restliche Etappe-3-Bereiche (Umplanung/Planung,
> Anforderungen, Besonderheiten, Nutzer-API) + DATEV-Outbox-Sync-Job.

## Schnellstart
```bash
npm install
npm run dev        # startet auf http://localhost:3001
npm test           # Vitest
npm run typecheck  # TypeScript ohne Emit
npm run lint       # ESLint (eigenes Server-Setup, laeuft auch in der CI)
npm run coverage   # Test-Abdeckung (Auswertung, bewusst ohne Zwangs-Prozentzahl)
```

> **Coverage-Lesart:** Kritische Fachmodule (Domain-Aktionen, Regeln, Policies, Routen) sind
> gezielt hoch abgedeckt; die MS-SQL-Adapter zeigen ohne echte Datenbank nur ihre (getesteten)
> Mapping-Funktionen — das ist erwartet, kein Testloch. E2E-Prüfläufe: `../tools/e2e/README.md`.

Demo-Login (NUR Entwicklung, In-Memory-Modus), Passwort für alle: `demo`
- `wolf`, `klein`, `berg` — Mitarbeiter
- `burchardt` — Partner + Admin

## Login-Schutz & Passwörter

- **Fehlversuchs-Sperre:** Nach **5** aufeinanderfolgenden Fehlversuchen (je Benutzername und je
  Client-IP) ist der Login für **15 Minuten** gesperrt (HTTP 429). Ein erfolgreicher Login setzt
  den Zähler zurück. Werte zentral in `src/auth/loginSchutz.ts`.
- **Protokoll:** Fehlgeschlagene und gesperrte Anmeldungen werden geloggt (Benutzername + IP,
  **niemals** Passwörter).
- **Deaktivierung wirkt sofort:** Der Auth-Hook lädt den Nutzer bei jedem Request neu; beide
  Repos liefern Deaktivierte nicht (`active = 0`). Auch eine laufende Session ist damit ab dem
  nächsten Request beendet — Deaktivieren: `UPDATE dbo.users SET active = 0 WHERE username = '…'`.
- **Passwortregeln:** mindestens **8 Zeichen** (durchgesetzt beim ersten Admin und im
  Hash-Helfer); Speicherung ausschließlich als **bcrypt-Hash**, nie im Klartext.
- **Passwort setzen/zurücksetzen** (bis die Nutzer-Verwaltung in der App kommt, Etappe 3):
  `npm run hash-password` (fragt interaktiv, nichts landet in Shell-History/Logs) → ausgegebenen
  Hash per SQL einspielen: `UPDATE dbo.users SET password_hash = '<hash>' WHERE username = '…'`.
- **Sessions:** In-Memory (bewusste Betriebsmodell-Entscheidung, eine zentrale Instanz) — nach
  Server-Neustart müssen sich alle neu anmelden; das ist akzeptiert.

## Datenbank einrichten (MS SQL)
Voraussetzung: eigene Datenbank + SQL-Benutzer auf der bestehenden MS-SQL-Instanz
(siehe „Was ihr vom ASP-Anbieter braucht" unten).

1. `.env` anlegen (Vorlage `.env.example`): `DB_MODE=mssql`, `DB_HOST`, `DB_NAME`,
   `DB_USER`, `DB_PASSWORD`; für den ersten Admin zusätzlich `SETUP_ADMIN_USER`,
   `SETUP_ADMIN_EMAIL`, `SETUP_ADMIN_PASSWORD`.
2. `npm run db:setup` — legt alle Tabellen an (idempotent, kann mehrfach laufen)
   und den ersten Admin, falls noch kein Nutzer existiert.
3. `npm run dev` — der Server nutzt jetzt die echten Nutzer aus der Datenbank.

Schema versioniert in `db/schema.sql` (reines T-SQL; Änderungen als weitere idempotente Blöcke).

**Was ihr vom ASP-Anbieter braucht (einmalig):**
- eine **eigene Datenbank** (z. B. `Zeiterfassung`) auf der bestehenden MS-SQL-Instanz,
- einen **eigenen SQL-Benutzer** (SQL-Authentifizierung) mit `db_owner` **nur** auf dieser DB,
- **Hostname/Instanz + Port** (Standard 1433) und von wo aus die DB erreichbar ist.

## Endpunkte
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/health` | Lebenszeichen |
| GET | `/api/health/datev` | DATEV-Adapter erreichbar? |
| POST | `/api/auth/login` | `{ username, password }` → setzt Session-Cookie |
| POST | `/api/auth/logout` | Session beenden |
| GET | `/api/auth/me` | aktueller Nutzer (erfordert Login) |
| GET | `/api/board` | Board-Aggregat: sichtbare Aufträge inkl. Overlay/Zeiten/Notes/Checkliste + Namen (der EINE Lese-Endpunkt) |
| POST | `/api/time` | Zeit buchen (`{ orderId, datum, dauer, … }`) → 201 |
| POST | `/api/time/:id/release` · `/withdraw` | eigene Zeit freigeben / zurücknehmen |
| DELETE | `/api/time/:id` | eigene, nicht übertragene Zeit löschen |
| POST | `/api/orders/:orderId/notes` | Note anlegen (Art aus Rolle) → 201 |
| PATCH · DELETE | `/api/notes/:id` | Text ändern / löschen (nach `notePolicy`) |
| POST | `/api/notes/:id/done` · `/reopen` · `/approve` | Note-Workflow (Frage/Review) |
| POST | `/api/notes/:id/comments` | Kommentar anhängen → 201 |
| POST | `/api/orders/:orderId/status` | Board-Status setzen (`{ status, position? }`) |
| POST | `/api/orders/:orderId/checklist/ensure` | Checkliste idempotent aus Vorlagen-Labels anlegen |
| POST | `/api/orders/:orderId/checklist` | Checklistenpunkt hinzufügen → 201 |
| POST | `/api/orders/:orderId/checklist/:itemId/done` | Punkt abhaken (`{ done }`) |
| DELETE | `/api/orders/:orderId/checklist/:itemId` | Checklistenpunkt löschen |

Fachfehler antworten mit passendem HTTP-Status (400/403/404/409) und einer kurzen,
unbedenklichen Meldung (`DomainError` → `httpStatusFor`).

**Auftrags-Sichtbarkeit:** Jede auftragsbezogene Aktion durchläuft `requireVisibleOrder`
(`domain/actions/access.ts`) — lädt den Auftrag über den DATEV-Port und erzwingt `canAccessOrder`
(`domain/visibility.ts`), dieselbe Regel wie `GET /api/orders`. Fehlender Zugriff antwortet
bewusst mit **404** (nicht 403), damit die API nicht verrät, ob eine Auftrags-ID existiert.

## Aufbau (3 Schichten, ADR-01)
```
src/
  routes/      API-Schicht (HTTP, Validierung)
  domain/      Fachregeln, Policies, Sichtbarkeit, Ports (kennen keine DB/DATEV)
  auth/        Passwörter (bcryptjs), Sessions
  infra/       austauschbare Adapter (memory/ In-Memory, mssql/ echte DB)
  datev/       DATEV-Adapter (mockAdapter Schein / httpAdapter echt, Fabrik in index.ts)
  plugins/     Fastify-Auth-Verdrahtung
  app.ts       baut die App per Dependency Injection (testbar)
  server.ts    Einstieg — wählt Adapter per DB_MODE/DATEV_MODE
db/
  schema.sql   Datenbank-Schema (MS SQL, idempotent) — MASSGEBLICH
scripts/
  db-setup.ts  wendet schema.sql an + legt ersten Admin an (npm run db:setup)
prisma/
  schema.prisma  frühere Design-Referenz (Prisma ersetzt durch mssql, s. ADR-04)
```

## Konfiguration
Werte über Umgebungsvariablen / lokale `.env` (siehe `.env.example`). **Keine Geheimnisse im Repo.**
