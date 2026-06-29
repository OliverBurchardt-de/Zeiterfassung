# Architektur

## Zielbild
```
[Browser SPA]  React + TypeScript (Vite)
     │  REST/JSON, eigener Login (Session/JWT)
     ▼
[App-Backend]  Node.js (Fastify) + TypeScript          ── Server im ASP-Umfeld
     ├── Auth/Benutzerverwaltung (eigener Login, Rollen: mitarbeiter | partner)
     ├── Eigene Persistenz (MS SQL Server, bestehende Instanz, eigene DB; Zugriff via Prisma):
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

> **Begründete Architektur-Entscheidungen (Schichten, Regeln serverseitig, DATEV-Adapter, DB,
> Sync, Login, Deployment): `docs/architektur-entscheidungen.md` (ADR-Stil).**

## Backend (Meilenstein 2, geplant)
- **Node.js + TypeScript** (Fastify), REST-API für die SPA.
- **MS SQL Server** für die eigene Persistenz (bestehende Instanz im ASP-Umfeld, **eigene Datenbank**
  + eigener DB-Benutzer; Zugriff/Migrationen über **Prisma**). Alles, was DATEV nicht abbildet.
- **DATEV-Adapter** als eigenes Modul mit klarer Schnittstelle (`getOrders`, `updateOrder`,
  `getEmployees`, …), damit Sandbox/Live und ein späterer API-Wechsel austauschbar bleiben.
- **E-Mail-Reminder-Job**: periodischer Scheduler; meldet Aufträge ohne erfasste Zeit bzw. mit
  nicht freigegebenen Zeiten an die Bearbeiter.

## DATEV-Anbindung — Netzwerk-„Ebene" & Deployment (M2)
**Kernproblem:** DATEVconnect ist eine **lokale** REST-Schnittstelle, die nur **innerhalb der
DATEV-Umgebung der Kanzlei** erreichbar ist (kein Internet-Zugang, Basic Auth, lauscht auf dem
DATEV-Host, z. B. `:58454`). Wer DATEVconnect aufruft, **muss in derselben Netzwerk-Ebene laufen**
wie DATEV — also im Kanzlei-LAN, mit Sicht auf den DATEV-Host. Das ist die „Ebene", die sichergestellt
werden muss.

**Hier ist die Kanzlei DATEVasp** — der DATEV-Host steht im **DATEV-Rechenzentrum (Nürnberg)**, nicht
im Büro. Folge: `localhost:58454` ist **nur auf dem ASP-Serversystem** erreichbar; eine App im
Kanzleinetz oder in der Cloud käme **nicht** heran. Externe Wege (Site-to-Site-VPN, Cloud Gateway)
sind **nicht der Weg** — siehe Entscheidung in `docs/datev-connect-asp-zugriff.md`.

**Konsequenz (festgelegt): Die App wird auf einem Server INNERHALB der ASP-Umgebung gehostet.**
Genau so läuft bereits die im Einsatz befindliche **Ingentis Kanzleisuite** der Kanzlei: eigener
Server im ASP-Umfeld, Bedienung im Browser über `localhost`. Unsere App spiegelt dieses Muster.

**Wer muss wo laufen?**
- **App-Backend (+ PostgreSQL) und DATEV-Adapter:** auf einem **Server im ASP-Umfeld**, der den
  DATEV-Host erreicht (`localhost`/ASP-internes LAN). Kein externer Netzweg nötig.
- **Browser-Frontend (SPA):** wird von diesem Server ausgeliefert; die Mitarbeiter öffnen die App
  **im Browser ihres ASP-Desktops** (wie bei Ingentis). Ruft nie direkt DATEVconnect auf.

**Offener Kernpunkt = Hosting der Eigenentwicklung im ASP-Umfeld** (mit DATEV/ASP-Partner klären,
versandfertige Anfrage in `docs/datev-asp-anfrage.md`):
- Wird ein **eigener Server/VM in DATEVasp** für eine **Eigenentwicklung** bereitgestellt (analog zur
  Ingentis-Anbindung), und unter welchem Modul/Vertrag?
- **Erlaubte Software/Laufzeit** auf dem ASP-Server: dürfen wir unseren Stack (Node.js + PostgreSQL +
  Web-Server) installieren, oder muss er paketiert/geprüft werden?
- **Deployment & Betrieb:** Wie spielen wir die App ein und aktualisieren sie (RDP-Zugang vs.
  Übergabe-Paket an DATEV)? Wer patcht das Betriebssystem, wer macht Backups?
- **DATEVconnect-Zugriff von diesem Server:** technischer Benutzer/Rechte (Basic Auth oder
  Service-SSO) für den **unbeaufsichtigten** Server-Zugriff; Rechte „DATEVconnect" + „EO comfort connect".
- **Sicherheit:** DATEVconnect bleibt rein intern; nur unser Backend vermittelt, mit TLS zur SPA.


| Datum | Quelle / Persistenz |
|---|---|
| Auftrag, Mandant, Auftragsart, Plandaten, Soll-Stunden, Ist-Werte | DATEV EO (lesen) |
| Status (DATEV `completion_status`), Plandaten, Verantwortliche | DATEV EO (Rückschreibung) |
| 10 Kanban-Status / Board-Position, Status-Historie | eigene DB |
| Erfasste Zeiten + Freigabestatus | eigene DB (Aggregat-Rückschreibung nach DATEV) |
| Review-Notes / Kommentare | eigene DB |
| Umplanungs-Freigaben, Checklisten, Auftragsart-Konfig, Reminder-Log | eigene DB |
