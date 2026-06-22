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

## DATEV-Anbindung — Netzwerk-„Ebene" & Deployment (M2)
**Kernproblem:** DATEVconnect ist eine **lokale** REST-Schnittstelle, die nur **innerhalb der
DATEV-Umgebung der Kanzlei** erreichbar ist (kein Internet-Zugang, Basic Auth, lauscht auf dem
DATEV-Host, z. B. `:58454`). Wer DATEVconnect aufruft, **muss in derselben Netzwerk-Ebene laufen**
wie DATEV — also im Kanzlei-LAN, mit Sicht auf den DATEV-Host. Das ist die „Ebene", die sichergestellt
werden muss.

**Wer muss wo laufen?**
- **Browser-Frontend (SPA):** beliebig — spricht nur unser App-Backend (HTTPS). Ruft **nie** direkt
  DATEVconnect auf.
- **DATEV-Adapter** (Teil des App-Backends): **muss on-prem im Kanzleinetz** laufen und den
  DATEV-Host erreichen (`http://<datev-host>:<port>`; `localhost` nur, wenn Adapter und DATEV auf
  **derselben** Maschine liegen).

**Empfohlenes Deployment (passt zur Entscheidung „On-Prem"):**
Das gesamte App-Backend (+ PostgreSQL) läuft auf einem **Server im Kanzleinetz**, im selben
Segment wie der DATEV-Arbeitsplatz. Der Adapter erreicht DATEVconnect über das LAN; die Mitarbeiter
öffnen die App im Browser (intern bzw. per VPN). Einfachste Variante für die DATEVconnect-Erreichbarkeit.

**Alternative, falls später Cloud-Hosting gewünscht ist:** App in der Cloud + **kleiner On-Prem-Agent**
im Kanzleinetz, der DATEVconnect anspricht und nur **ausgehend** mit der Cloud synchronisiert (kein
eingehender Port von außen auf DATEV → kein Loch in der Firewall). Mehr Aufwand; nur wenn nötig.

**Vor der M2-Umsetzung zu klären / zu verifizieren:**
- Auf **welcher Maschine** läuft DATEVconnect, welche **Version**, welcher **Port**? Ist die
  Komponente überhaupt lizenziert/installiert (DATEVconnect-Freischaltung)?
- **Netzwerkpfad:** Erreicht der geplante App-Server den DATEV-Host (Firewall/Routing im LAN)?
- **Technischer DATEVconnect-Benutzer** (Basic Auth) mit passenden Rechten.
- **Verfügbarkeit:** DATEV-Host muss für Sync/Polling laufen (Zeitfenster, Nacht-Sync?).
- **Sicherheit:** DATEVconnect bleibt rein intern; nur unser Backend vermittelt, mit TLS zur SPA.


| Datum | Quelle / Persistenz |
|---|---|
| Auftrag, Mandant, Auftragsart, Plandaten, Soll-Stunden, Ist-Werte | DATEV EO (lesen) |
| Status (DATEV `completion_status`), Plandaten, Verantwortliche | DATEV EO (Rückschreibung) |
| 10 Kanban-Status / Board-Position, Status-Historie | eigene DB |
| Erfasste Zeiten + Freigabestatus | eigene DB (Aggregat-Rückschreibung nach DATEV) |
| Review-Notes / Kommentare | eigene DB |
| Umplanungs-Freigaben, Checklisten, Auftragsart-Konfig, Reminder-Log | eigene DB |
