# Backend (M2) — Zeiterfassung & Auftragsabwicklung

Server der App: REST-API, eigener Login, eigene Persistenz, DATEV-Adapter. Architektur-Grundlage:
`../docs/architektur-entscheidungen.md` (ADRs), Fahrplan: `../docs/m2-plan.md`.

> **Stand:** Gerüst + echte Adapter. Default läuft gegen **In-Memory**-Daten und einen
> **Schein-DATEV-Adapter** (ohne Datenbank/DATEV lauffähig und testbar). Zuschaltbar sind der
> **echte DATEVconnect-Adapter** (`DATEV_MODE=http`) und die **MS-SQL-Persistenz**
> (`DB_MODE=mssql`; **alle** Fach-Repositories: Nutzer, Zeiten, Notes, Board-Overlay, Checklisten,
> Status-Historie, Outbox, Anforderungen, Besonderheiten) — `buildApp` bleibt gleich.
> Darauf setzen die **Fach-Aktionen + API-Routen** für Zeit, Note und Status
> (`/api/time*`, `/api/orders/:id/notes`, `/api/notes/:id/*`, `/api/orders/:id/status*`)
> mit serverseitig verbindlichem Rollen-/Workflow-Gating. Nächster Schritt: Frontend anschließen.

## Schnellstart
```bash
npm install
npm run dev        # startet auf http://localhost:3001
npm test           # Vitest
npm run typecheck  # TypeScript ohne Emit
```

Demo-Login (NUR Entwicklung, In-Memory-Modus), Passwort für alle: `demo`
- `wolf`, `klein`, `berg` — Mitarbeiter
- `burchardt` — Partner + Admin

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
| GET | `/api/orders` | sichtbare Aufträge (Rollen-gefiltert) |
| GET | `/api/time/mine` | eigene Zeiteinträge |
| POST | `/api/time` | Zeit buchen (`{ orderId, datum, dauer, … }`) → 201 |
| POST | `/api/time/:id/release` · `/withdraw` | eigene Zeit freigeben / zurücknehmen |
| DELETE | `/api/time/:id` | eigene, nicht übertragene Zeit löschen |
| GET · POST | `/api/orders/:orderId/notes` | Notes lesen / anlegen (Art aus Rolle) |
| PATCH · DELETE | `/api/notes/:id` | Text ändern / löschen (nach `notePolicy`) |
| POST | `/api/notes/:id/done` · `/reopen` · `/approve` | Note-Workflow (Frage/Review) |
| POST | `/api/notes/:id/comments` | Kommentar anhängen → 201 |
| POST | `/api/orders/:orderId/status` | Board-Status setzen (`{ status, position? }`) |
| GET | `/api/orders/:orderId/status-history` | Status-Historie |

Fachfehler antworten mit passendem HTTP-Status (400/403/404/409) und einer kurzen,
unbedenklichen Meldung (`DomainError` → `httpStatusFor`).

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
