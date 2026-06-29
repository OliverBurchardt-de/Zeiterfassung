# Backend (M2) — Zeiterfassung & Auftragsabwicklung

Server der App: REST-API, eigener Login, eigene Persistenz, DATEV-Adapter. Architektur-Grundlage:
`../docs/architektur-entscheidungen.md` (ADRs), Fahrplan: `../docs/m2-plan.md`.

> **Stand:** Erstes Gerüst. Läuft gegen **In-Memory**-Daten und einen **Schein-DATEV-Adapter**,
> damit alles ohne Datenbank und ohne DATEV-Zugang lauffähig und testbar ist. Die echte MS-SQL-
> Anbindung (Prisma) und der HTTP-DATEV-Adapter folgen als nächste Schritte — `buildApp` bleibt gleich.

## Schnellstart
```bash
npm install
npm run dev        # startet auf http://localhost:3001
npm test           # Vitest
npm run typecheck  # TypeScript ohne Emit
```

Demo-Login (NUR Entwicklung), Passwort für alle: `demo`
- `wolf`, `klein`, `berg` — Mitarbeiter
- `burchardt` — Partner + Admin

## Endpunkte
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/health` | Lebenszeichen |
| GET | `/api/health/datev` | DATEV-Adapter erreichbar? |
| POST | `/api/auth/login` | `{ username, password }` → setzt Session-Cookie |
| POST | `/api/auth/logout` | Session beenden |
| GET | `/api/auth/me` | aktueller Nutzer (erfordert Login) |
| GET | `/api/orders` | sichtbare Aufträge (Rollen-gefiltert) |

## Aufbau (3 Schichten, ADR-01)
```
src/
  routes/      API-Schicht (HTTP, Validierung)
  domain/      Fachregeln, Policies, Sichtbarkeit, Ports (kennen keine DB/DATEV)
  auth/        Passwörter (bcryptjs), Sessions
  infra/       austauschbare Adapter (aktuell In-Memory)
  datev/       DATEV-Adapter (aktuell Schein-DATEV nach verifizierter Feld-Referenz)
  plugins/     Fastify-Auth-Verdrahtung
  app.ts       baut die App per Dependency Injection (testbar)
  server.ts    Einstieg für die Entwicklung
prisma/
  schema.prisma  Datenmodell (MS SQL) — Design, Aktivierung folgt
```

## Konfiguration
Werte über Umgebungsvariablen / lokale `.env` (siehe `.env.example`). **Keine Geheimnisse im Repo.**
