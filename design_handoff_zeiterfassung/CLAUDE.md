# CLAUDE.md — Zeiterfassung & Auftragsabwicklung (Burchardt & Kollegen)

> Persistenter Projektkontext für Claude Code. Lies zuerst `design/README.md` für die
> vollständige Design-Spezifikation. Diese Datei fasst Auftrag, Stack und Konventionen zusammen.

## Was wir bauen
Interne Web-App für die Steuerkanzlei **Burchardt & Kollegen**. Mitarbeiter erledigen an einer
Stelle: **Auftragsplanung**, **Auftragsabwicklung** (Kanban-Board mit 10 Status, Planner-Stil)
und **Zeiterfassung** am Auftrag. Aufträge kommen aus **DATEV EO** (API). Review-Anmerkungen
und Freigaben laufen zwischen **Mitarbeiter** und **mandatsverantwortlichem Partner**.

Die vollständige Spezifikation (Domänenmodell, alle Screens mit Maßen/Farben/Typo, Workflows,
Design-Tokens) steht in **`design/README.md`**. Verbindlicher Hi-fi-Prototyp:
**`design/Zeiterfassung Prototyp (standalone).html`** (im Browser öffnen). Screenshots in
`design/screenshots/`.

## Empfohlener Stack
- **React + TypeScript** (Vite; Next.js nur, wenn SSR/Routing-Bedarf entsteht).
- **State:** Server-State via **TanStack Query** (Orders/Times/Notes von der API), UI-State via
  Zustand oder React Context. Eine Quelle der Wahrheit für `orders`.
- **Drag & Drop:** `@dnd-kit/core` + `@dnd-kit/sortable` fürs Board.
- **Styling:** CSS-Variablen aus `design/design-tokens.css` (oder Tailwind-Config aus denselben
  Werten). Komponenten als kleine, testbare Bausteine.
- **Icons:** `lucide-react`. **Keine Emojis.**
- **Fonts:** Petrona (Display, liegt in `design/fonts/`) + Aleo (Body, Google Fonts).

> Falls das Team einen anderen Stack bevorzugt, ist das ok — die Designs sind framework-neutral.
> Wichtig ist die pixelnahe Umsetzung gemäß `README.md`.

## Architektur-Leitplanken
- **Single Source of Truth `orders[]`**; alle Mutationen (Status, Notes, Kommentare, Checkliste,
  Zeiten) immutabel auf das jeweilige Order-Objekt, dann an die API persistieren.
- **Status** ändert sich auf **zwei** Wegen: Drag & Drop **und** Status-Leiste im Karten-Detail.
  Beide schreiben `order.status`.
- **Rollen-Gating** zentral lösen (z. B. `useRole()` + Policy-Helper), nicht in der UI verstreuen.
- **Spalten `ua`/`uv`** nur für Auftragsarten mit Unterlagen-Prozess (per Auftragsart-Konfig).

## Fachliche Kernregeln (Kurzfassung — Details in README)
- **Geplanter Monat** wird aus den EO-Datumsfeldern (`fristStart`/`fristEnde`) abgeleitet.
- **Review Notes / Fragen** = Thread mit `kind` (`frage` = nur Mitarbeiter, `review` = nur
  Partner) und `noteState` (`offen → erledigt → freigegeben`). **Kommentieren/Bearbeiten:** beide.
  **Als erledigt melden:** Mitarbeiter. **Freigeben + Löschen:** nur Partner.
- **Zeiterfassung:** Live-Timer **oder** manuell; übertragene Zeit ist „nicht freigegeben" bis
  Partner-Freigabe. **E-Mail-Reminder** (Backend-Job) für Aufträge ohne Zeit / mit nicht
  freigegebenen Zeiten.
- **Umplanung** in anderen Monat → **Freigabe-Anfrage an den Partner** (Badge
  „Freigabe ausstehend").

## Datenquellen / offene Punkte fürs Backend
- DATEV-EO-Anbindung (Auth, Polling vs. Webhook, Feldmapping) ist **noch zu spezifizieren**.
- Eigene Persistenz für: erfasste Zeiten + Freigabestatus, Review-Notes/Kommentare,
  Status-Historie, Umplanungs-Freigaben, E-Mail-Reminder-Job.
- Auftragsart-Konfiguration (welche Arten brauchen `ua`/`uv`).

## Empfohlene Reihenfolge
1. Design-Tokens + Grund-Layout (Top-Bar, 3-Spalten-Grid).
2. Board mit Spalten + Karten (read-only aus Mock/EO).
3. Karten-Detail-Modal: Stammdaten, Status-Leiste, Stunden.
4. Zeiterfassung (Timer + manuell + Liste).
5. Review-Notes-Thread inkl. Rollen-Workflow.
6. Unterlagen-Checkliste (editierbar).
7. Drag & Drop fürs Board.
8. Filter (Mitarbeiter/Monat/Auftragsart/Schnellfilter), Umplanung-Freigabe.
9. Backend/EO-Integration + E-Mail-Reminder.

## Definition of Done (pro UI-Baustein)
- Entspricht `README.md` (Farben/Typo/Abstände) und dem Standalone-Prototyp.
- Rollen-Regeln korrekt durchgesetzt.
- Keine Emojis; Marken-Tokens statt Hardcode-Hex, wo möglich.
- Tastatur-/Fokus-Zustände und Hover gemäß Design.
