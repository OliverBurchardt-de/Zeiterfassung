# Zeiterfassung & Auftragsabwicklung — Burchardt & Kollegen

Interne Web-App der Steuerkanzlei **Burchardt & Kollegen**, die **Auftragsplanung**,
**Auftragsabwicklung** (Kanban-Board im Planner-Stil mit 10 Status) und **Zeiterfassung**
an einer Stelle vereint. Auftragsdaten stammen aus **DATEV EO** (Eigenorganisation);
Status, Plandaten und Verantwortlichkeiten werden nach **DATEV EO Comfort** zurückgeschrieben.

> **Aktueller Stand (12.07.2026):** Meilenstein 1 (klickbares Frontend, Demo-Modus) ist
> abgenommen; Meilenstein 2 läuft: eigenes Backend in `server/` (Fastify, eigener Login mit
> Fehlversuchs-Sperre, In-Memory- oder MS-SQL-Persistenz mit versionierten Migrationen,
> DATEV-Adapter mock/http) und Server-Modus des Frontends (`npm run dev:api`) mit echtem Login,
> Board über `GET /api/board` und serverseitig festgeschriebenen Aktionen
> (Zeit/Notes/Status/Checklisten inkl. Pflichtpunkt-/Soft-Delete-Regeln). E-Mail-Reminder und
> DATEV-Sync-Job folgen (siehe `docs/m2-plan.md`; aktuelle Prüfstände: CI).

## Stack
- **React 18 + TypeScript** (Vite)
- **Drag & Drop:** `@dnd-kit`
- **State:** Zustand (`src/state/store.ts`) als Single Source of Truth für `orders[]`
- **Icons:** `lucide-react` (keine Emojis)
- **Design-Tokens:** `src/styles/tokens.css` + `src/lib/tokens.ts` (aus dem Design-Handoff)

## Schnellstart
```bash
npm install
npm run dev        # http://localhost:5173
```
Weitere Skripte: `npm run build`, `npm run preview`, `npm run typecheck`, `npm run lint`.

## Funktionen (Meilenstein 1)
- **Board** mit 10 Status-Spalten; Aufträge per **Drag & Drop** verschieben (= Statuswechsel)
  oder über die Status-Leiste im Detail. Spalten *Unterlagen anfordern/vollständig* nur für
  Auftragsarten mit Unterlagen-Prozess.
- **Filter-Leiste:** Mitarbeiter, geplanter Monat, Auftragsart, Schnellfilter
  (offene Zeiten / Freigabe ausstehend).
- **KPIs** und rechte Übersicht (heute erfasst, offene Zeiten, Review Notes).
- **Karten-Detail-Modal:** Stammdaten, Status-Leiste, Stunden-Fortschritt, Plandaten,
  **Umplanung** (Freigabe-Anfrage an Partner), **Zeiterfassung** (Live-Timer + manuell +
  Status `erfasst → freigegeben → übertragen`, Selbst-Freigabe durch den Mitarbeiter),
  **Unterlagen-Checkliste**, **Review-Notes-Thread** mit Rollen-Workflow.
- **Rollen-Umschalter** (Mitarbeiter / Partner) — schaltet Aktionen frei (Demo).

## Projektstruktur
```
src/
  app/            Top-Bar, KPI-Header
  features/board  Board, Spalten, Karten, Filter, rechte Spalte, Drag & Drop
  features/order  Karten-Detail-Modal, Status, Plandaten, Umplanung
  features/time   Timer + manuelle Erfassung + Checkliste
  features/notes  Review-Notes-Thread + Rollen-Policy
  state/          Zustand-Store + Selektoren
  lib/            Typen, Design-Tokens, Helfer (Auftragsart/Formatierung)
  mock/           Beispieldaten (ersetzbar durch DATEV-EO/API)
server/           Backend (M2, begonnen): Fastify-API, Login, Domain, DATEV-Adapter (siehe server/README.md)
docs/             Architektur, DATEV-Integration, Lastenheft
design_handoff_zeiterfassung/   verbindliche Design-Referenz (Prototyp, Screenshots, Tokens)
```

> **Backend (M2):** liegt in `server/` (Default: in-memory + Schein-DATEV; zuschaltbar MS SQL +
> echter DATEVconnect-Adapter). Details: `server/README.md`, Architektur:
> `docs/architektur-entscheidungen.md`. E2E-Prüfläufe: `tools/e2e/README.md`.

## Dokumentation

**Kontext & Anforderungen**
- `CLAUDE.md` — Projektkontext & Konventionen (zentrale Datei für KI-gestützte Entwicklung)
- `docs/lastenheft.md` — Flow, Regeln, offene Punkte
- `design_handoff_zeiterfassung/README.md` — vollständige Design-Spezifikation

**Architektur**
- `docs/architektur.md` — Zielarchitektur (Frontend, Backend, DATEV-Adapter, Persistenz)
- `docs/architektur-entscheidungen.md` — begründete Architektur-Entscheidungen fürs M2-Backend (ADR-Stil)

**DATEV-Anbindung**
- `docs/echtdaten-lokal-testen.md` — Schritt für Schritt: echte DATEV-Aufträge lokal am Kanzlei-PC ansehen
- `docs/datev-integration.md` — Feld-Mapping & Rückschreibung nach EO Comfort
- `docs/datev-connect-handoff.md` — projektunabhängige, verifizierte DATEVconnect-Mechanik (zur Wiederverwendung)
- `docs/datev-connect-asp-zugriff.md` — DATEVconnect unter ASP: Anbindungswege, Voraussetzungen, Test (Pull/Writeback)
- `docs/datev-developer-portal.md` — Developer-Portal: Onboarding, Cloud vs. On-Premise, Auth, Links
- `docs/datev-test-anleitung.md` — Schritt-für-Schritt-Test auf dem ASP-Server
- `docs/datev-asp-anfrage.md` — versandfertige Hosting-Anfrage an den DATEV-/ASP-Partner

**Planung, Abnahme & Qualität**
- `docs/m2-plan.md` — Fahrplan von M1 (Mock) zu M2 (Backend + DATEV)
- `docs/abc-analyse-konzept.md` — ABC-Analyse (Mandanten-Rentabilität): API-Felder, Logik, Andockpunkt (vorgesehen, nicht v1)
- `docs/ideen-backlog.md` — Ideen-/Aufgaben-Backlog
- `docs/m1-abnahme.md` — M1-Abnahme-Checkliste
- `docs/reviews/` — Review-Protokolle (Eigen-, UI-, externe Code-Reviews)
