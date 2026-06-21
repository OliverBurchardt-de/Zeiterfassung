# Zeiterfassung & Auftragsabwicklung — Burchardt & Kollegen

Interne Web-App der Steuerkanzlei **Burchardt & Kollegen**, die **Auftragsplanung**,
**Auftragsabwicklung** (Kanban-Board im Planner-Stil mit 10 Status) und **Zeiterfassung**
an einer Stelle vereint. Auftragsdaten stammen aus **DATEV EO** (Eigenorganisation);
Status, Plandaten und Verantwortlichkeiten werden nach **DATEV EO Comfort** zurückgeschrieben.

> **Aktueller Stand:** Meilenstein 1 — klickbares Frontend mit Mock-Daten (kein Backend).
> Backend, DATEV-Anbindung und E-Mail-Reminder folgen in Meilenstein 2 (siehe `docs/`).

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
  **Umplanung** (Freigabe-Anfrage), **Zeiterfassung** (Live-Timer + manuell + Freigabe),
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
docs/             Architektur, DATEV-Integration, Lastenheft
design_handoff_zeiterfassung/   verbindliche Design-Referenz (Prototyp, Screenshots, Tokens)
```

## Dokumentation
- `CLAUDE.md` — Projektkontext & Konventionen
- `docs/architektur.md` — Zielarchitektur (Frontend, Backend, DATEV-Adapter, Persistenz)
- `docs/datev-integration.md` — Feld-Mapping & Rückschreibung nach EO Comfort
- `docs/lastenheft.md` — Flow, Regeln, offene Punkte
- `design_handoff_zeiterfassung/README.md` — vollständige Design-Spezifikation
