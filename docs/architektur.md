# Architektur

## Zielbild
```
[Browser SPA]  React + TypeScript (Vite)
     │  REST/JSON, eigener Login (Session/JWT)
     ▼
[App-Backend]  Node.js (Fastify/Express) + TypeScript   ── on-prem im Kanzleinetz
     ├── Auth/Benutzerverwaltung (eigener Login, Rollen: mitarbeiter | partner)
     ├── Eigene Persistenz (PostgreSQL):
     │     Zeiten + Freigaben, Review-Notes/Kommentare, Status-Historie,
     │     Umplanungs-Freigaben, Checklisten, Auftragsart-Konfig, Reminder-Log
     ├── E-Mail-Reminder-Job (Scheduler)
     └── DATEV-Adapter (austauschbar)
            │ Basic Auth
            ▼
     [DATEVconnect / Order Management v1]  localhost:58454  (read + writeback EO Comfort)
```

## Entscheidungen (abgestimmt)
- **DATEV-Anbindung:** On-Premise DATEVconnect (Basic Auth, lokaler Server im Kanzleinetz).
- **Hosting & Login:** On-Prem-Server nah an DATEVconnect, eigener Login / eigene Benutzerverwaltung
  (kein Microsoft-365-SSO).
- **Erster Meilenstein:** klickbares Frontend mit Mock-Daten (umgesetzt).

## Frontend (Meilenstein 1, umgesetzt)
- **Single Source of Truth `orders[]`** im Zustand-Store (`src/state/store.ts`); alle Mutationen
  immutabel. UI-State (Rolle, Filter, geöffnete Karte, Timer) ebenfalls im Store.
- **Status-Änderung** auf zwei Wegen, beide via `setStatus`: Drag & Drop (`features/board/Board.tsx`,
  `@dnd-kit`) und Status-Leiste im Detail (`features/order/OrderModal.tsx`).
- **Rollen-Policy** zentral in `src/lib/tokens.ts` (`notePolicy`).
- **Daten** aus `src/mock/orders.ts`. Beim Umstieg auf das Backend werden Lesen/Schreiben über
  TanStack-Query-Hooks gekapselt; die Komponenten bleiben unverändert.

## Backend (Meilenstein 2, geplant)
- **Node.js + TypeScript** (Fastify oder Express), REST-API für die SPA.
- **PostgreSQL** für die eigene Persistenz (alles, was DATEV nicht abbildet).
- **DATEV-Adapter** als eigenes Modul mit klarer Schnittstelle (`getOrders`, `updateOrder`,
  `getEmployees`, …), damit Sandbox/Live und ein späterer API-Wechsel austauschbar bleiben.
- **E-Mail-Reminder-Job**: periodischer Scheduler; meldet Aufträge ohne erfasste Zeit bzw. mit
  nicht freigegebenen Zeiten an die Bearbeiter.

## Datenhaltung: DATEV vs. eigene DB
| Datum | Quelle / Persistenz |
|---|---|
| Auftrag, Mandant, Auftragsart, Plandaten, Soll-Stunden, Ist-Werte | DATEV EO (lesen) |
| Status (DATEV `completion_status`), Plandaten, Verantwortliche | DATEV EO (Rückschreibung) |
| 10 Kanban-Status / Board-Position, Status-Historie | eigene DB |
| Erfasste Zeiten + Freigabestatus | eigene DB (Aggregat-Rückschreibung nach DATEV) |
| Review-Notes / Kommentare | eigene DB |
| Umplanungs-Freigaben, Checklisten, Auftragsart-Konfig, Reminder-Log | eigene DB |
