# CLAUDE.md — Zeiterfassung & Auftragsabwicklung (Burchardt & Kollegen)

> Persistenter Projektkontext für Claude Code. Verbindliche Design-Spezifikation:
> `design_handoff_zeiterfassung/README.md`. Hi-fi-Prototyp:
> `design_handoff_zeiterfassung/Zeiterfassung Prototyp (standalone).html`.

## Was wir bauen
Interne Web-App für die Steuerkanzlei **Burchardt & Kollegen**: an einer Stelle
**Auftragsplanung**, **Auftragsabwicklung** (Kanban-Board, 10 Status, Planner-Stil) und
**Zeiterfassung** am Auftrag. Aufträge kommen aus **DATEV EO** (On-Premise DATEVconnect);
Status/Plandaten/Verantwortliche werden nach **EO Comfort** zurückgeschrieben. Review-Notes und
Freigaben laufen zwischen **Mitarbeiter** und **mandatsverantwortlichem Partner**.

## Stack (umgesetzt)
- React 18 + TypeScript (Vite), `@dnd-kit` fürs Board, `lucide-react` (keine Emojis).
- **State:** Zustand-Store `src/state/store.ts` — Single Source of Truth `orders[]`.
  In Produktion wird der orders-Teil durch Server-State (TanStack Query / DATEV-EO) ersetzt;
  UI-State (role, Filter, openCardId, Timer) bleibt lokal.
- Styling über CSS-Variablen aus `src/styles/tokens.css` (Marken-Tokens, keine Hardcode-Hex).

## Architektur-Leitplanken
- **Single Source of Truth `orders[]`**; alle Mutationen immutabel über das Order-Objekt
  (siehe `mapOrder`/`mapNote` im Store).
- **Status** ändert sich auf **zwei** Wegen: Drag & Drop (`Board.tsx`) **und** Status-Leiste im
  Detail (`OrderModal.tsx`). Beide rufen `setStatus`.
- **Rollen-Gating zentral** über `notePolicy` (in `src/lib/tokens.ts`) — nicht in der UI verstreuen.
- **Spalten `ua`/`uv`** nur für Auftragsarten mit Unterlagen-Prozess (`hasUnterlagenProzess`
  in `src/lib/art.ts`).

## Fachliche Kernregeln (Details in `design_handoff_zeiterfassung/README.md`)
- **Geplanter Monat** aus EO-Datumsfeldern (`fristStart`/`fristEnde`).
- **Review Notes / Fragen** = Thread mit `kind` (`frage` = Mitarbeiter, `review` = Partner) und
  `noteState` (`offen → erledigt → freigegeben`). Erledigt melden: Mitarbeiter. Freigeben/Löschen:
  nur Partner. Kommentieren/Bearbeiten: beide.
- **Zeiterfassung:** Live-Timer oder manuell; übertragene Zeit ist „nicht freigegeben" bis
  Partner-Freigabe. E-Mail-Reminder (Backend-Job, M2) für Aufträge ohne Zeit / mit nicht
  freigegebenen Zeiten.
- **Umplanung** in anderen Monat → Freigabe-Anfrage an den Partner (Badge „Freigabe ausstehend").

## Konventionen / Definition of Done
- Entspricht `design_handoff_zeiterfassung/README.md` (Farben/Typo/Abstände) und dem Prototyp.
- Rollen-Regeln korrekt durchgesetzt; keine Emojis; Marken-Tokens statt Hardcode-Hex.
- `npm run typecheck` + `npm run lint` sauber.

## Roadmap
Meilenstein 1 (umgesetzt): klickbares Frontend mit Mock-Daten (`src/mock/orders.ts`).
Meilenstein 2: App-Backend (Node+TS) + PostgreSQL + eigener Login, DATEV-Adapter (DATEVconnect,
Basic Auth) für Lesen + Rückschreibung, eigene Persistenz, E-Mail-Reminder. Siehe `docs/`.
