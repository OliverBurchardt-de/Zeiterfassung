# M2-Plan — Backend, DATEV-Anbindung & Betrieb

> **Status:** Entwurf zur Abstimmung (27.06.2026). Hängt an `docs/architektur.md` (Zielbild,
> Deployment) und `docs/datev-integration.md` (Feld-/Status-Mapping, verifizierte API-Befunde).
> Dieses Dokument ist der **Fahrplan** von M1 (klickbarer Mock) zu M2 (echtes Backend + DATEV).
> Doppelt nichts aus den beiden Referenzdokumenten — es ordnet, priorisiert und plant.

## Abgestimmte Vorgehens-Entscheidungen (27.06.2026)
- **Reihenfolge:** Erst **schriftlicher Plan** (dieses Dokument), dann Umsetzung.
- **M2-Start:** **DATEV-Spike zuerst** — das DATEV-Verhalten ist das größte Risiko
  (PUT überschreibt vollständig; Rechte/Verfügbarkeit/Netzwerk noch nicht final).
- **Zeit-Rückschreibung:** **im Spike final klären** (Befund: `expensepostings` funktioniert bereits,
  s. u. — verbleibt die Absicherung von Dubletten/Idempotenz und Mengen).
- **Noch im Mock (M1) zu bauen, vor dem Backend:**
  1. **Auftrags-Anforderung** (Mitarbeiter → Backoffice-Inbox, „als angelegt melden").
  2. **Umplanungs-Regeln JA/ESt** (1× Umplanung/Jahr frei, danach Partner-Freigabe).

---

## Phase 0 — Mock-Vorarbeiten (M1, ohne Backend)
Diese zwei Workflows lassen sich vollständig im Frontend modellieren und schärfen die fachlichen
Regeln, **bevor** sie ins Backend wandern. Sie sind die letzten M1-Bausteine.

### 0.1 Auftrags-Anforderung (Workflow-Mock)
- **Warum Workflow, nicht API:** DATEV kennt **kein `POST /orders`** (verifiziert, s.
  `datev-integration.md` „Aufträge anlegen/löschen"). Aufträge entstehen nur in DATEV EO; das Tool
  spiegelt. Anforderung = interner Workflow, keine API-Schreibaktion.
- **Datenmodell (Store):** `AuftragsAnforderung { id, mandantNr, mandant, ordertype, vj, zeitraum?,
  notiz, erstelltVon, erstelltAm, status: 'angefordert' | 'angelegt' | 'abgelehnt', grund? }`.
  Persistiert wie `orders` (localStorage, version bump).
- **UI:** Reiter/Modul **„Anforderungen"** (oder Knopf „Auftrag anfordern" im Board-Kopf) →
  Formular (Mandant, Auftragsart aus `ORDERTYPES`, VJ/Zeitraum, Notiz). **Backoffice-Inbox**
  (Admin/Backoffice-Sicht) mit Liste offener Anforderungen + Aktionen „als angelegt melden" /
  „ablehnen (mit Grund)".
- **Sichtbarkeit:** Mitarbeiter sieht **eigene** Anforderungen + deren Status; Backoffice/Admin
  sieht alle. (Greift auf das bereits vorhandene Login/Visibility-Muster zurück.)
- **M2-Anschluss:** Schritt „angefordert" löst dann eine **echte E-Mail** ans Backoffice aus
  (Backend-Job, wie der Reminder); „angelegt" kommt nach manueller DATEV-Anlage automatisch per Sync.
- **Offen (vor Bau kurz bestätigen):** eigenes Modul **oder** Knopf im Board-Kopf? Soll der
  Mitarbeiter zusätzlich eine In-App-Benachrichtigung sehen?

### 0.2 Umplanungs-Regeln JA & Einkommensteuer
- **Regel:** **Erstplanung** aus dem Pool ist frei (Mitarbeiter). Danach gilt für `ja`/`est`-Aufträge:
  **1× Umplanung pro Jahr frei**, **jede weitere** Umplanung braucht **Partner-Freigabe**
  (vorhandener Umplanungs-Mechanismus → Badge „Freigabe ausstehend").
- **Datenmodell:** am Order ein Zähler `umplanungenImJahr` (bzw. `umplanungVerbrauchtVj: number`),
  zurückgesetzt pro Veranlagungsjahr. Partner kann die Sperre aufheben (Freigabe = Verbrauch +1).
- **Drag & Drop (Planung):** Verschieben eines **bereits geplanten** `ja`/`est`-Auftrags löst —
  wenn das Freikontingent aufgebraucht ist — **direkt eine Freigabe-Anfrage** aus, statt sofort zu
  verschieben (Order bleibt im alten Monat, `umplanung.zielMonat` gesetzt).
- **Durchsetzung zentral** in `rolePolicy`/Store (`requestUmplanung`/`approveUmplanung`), nicht in
  der UI verstreuen — analog zu den bestehenden Policies.
- **Offen (vor Bau kurz bestätigen):** Kontingent pro **Veranlagungsjahr** oder Kalenderjahr? Gilt
  die „1×"-Regel nur für `ja`/`est` oder auch andere Projekt-Arten? Hebt **nur** der Partner die
  Sperre auf (Annahme: ja)?

---

## Phase 1 — DATEV-Spike (zuerst, gegen die Live-Instanz)
**Ziel:** alle DATEV-Unbekannten ausräumen, bevor Backend-Code entsteht. Vieles ist bereits
verifiziert (s. `datev-integration.md`); der Spike **bestätigt** das in der Kanzlei-Umgebung und
schließt die Restlücken. **Voraussetzung:** Zugriff auf die DATEVconnect-Instanz im Kanzleinetz
(technischer Benutzer, Basic Auth) — das kann ich nicht remote, das läuft **on-prem** bei euch;
ich liefere das Skript/die Checkliste und werte die Ergebnisse aus.

### Bereits verifiziert (Live, 25./26.06.2026) — nur noch gegenprüfen
- ✅ `GET /ordertypes` (Katalog, Gruppen, `isinternal`) — Grundlage der Auftragsart-Konfig.
- ✅ `GET /orders` + eingebettete `suborders[]`; Feld-Mapping (s. `datev-integration.md`).
- ✅ `master-data/v1/employees` liefert die `employee_id` (GUID) für Buchungen.
- ✅ **Zeitbuchung `POST …/suborders/{id}/expensepostings`** erfolgreich (`HTTP 201`):
  `time-costs`, `time_units` (1 h = 1200), **ohne `Start_time`**, **`id` weglassen**, **nicht
  idempotent** → Dubletten-Schutz nötig.
- ✅ `costitems` (Plan, `accounting_allowed` dynamisch) vs. `expensepostings` (Ist).

### Im Spike noch final zu klären
1. **Hosting im ASP-Umfeld (festgelegt):** Die App läuft auf einem **Server innerhalb der
   DATEVasp-Umgebung** (wie die bestehende Ingentis Kanzleisuite) → `localhost`-Zugriff, kein
   externer Netzweg. Offen ist die **Bereitstellung/Deployment** dieses Servers für eine
   Eigenentwicklung — mit DATEV/ASP-Partner klären (versandfertige Anfrage:
   `docs/datev-asp-anfrage.md`; Architektur: `architektur.md`).
2. **Technischer Benutzer & Rechte:** Welche DATEVconnect-Rechte braucht der Service-Account für
   GET **und** PUT/POST? Schreibrechte real testen.
3. ✅ **`PUT /orders/{id}` Roundtrip — bestätigt (29.06.2026):** Read-Modify-Write an einem
   Test-Auftrag erfolgreich (planned_hours 10→11→10). **Wichtig:** PUT verlangt das **vollständige
   Objekt mit allen Pflichtfeldern** (u. a. `billing_status`); GET lässt leere Felder weg → der
   Adapter muss Pflichtfelder garantieren (sonst `EODC10009`). Enums s. `datev-integration.md`.
4. **`planned_start/end` Writeback** (Umplanung) + **Suborder `date_work_completed`** (Teilauftrag
   erledigt) testen.
5. **`completion_status`-Übergänge:** vollständige Zuordnung der 10 App-Status → welche lösen
   Writeback aus, welche bleiben rein App-intern (Status-Historie).
6. **Zeit-Sync absichern:** Dubletten-Schutz (Idempotenz-Schlüssel je Eintrag; Status sofort auf
   `uebertragen`), `automaticintegration`/`deletemassdataonfailure`-Verhalten, ZMA-Fehlerfälle.
7. **`billing_status`/Faktura-Feld** für Controlling „noch nicht abgerechnet" am Live-System
   benennen.
8. **Verfügbarkeit:** Sync-Zeitfenster (DATEV-Host an?), Diagnostics-API
   (`Diagnostics and Functional Tests-1.1.2.json`) für Health-Check.

**Deliverable des Spikes:** kurzes Ergebnis-Protokoll (`docs/reviews/<datum>-datev-spike.md`) mit
bestätigten Annahmen, offenen Risiken und dem finalen Status-Mapping. Erst danach Phase 2.

---

## Phase 2 — Backend-Gerüst
> Architektur-Grundlage (Schichten, Regeln serverseitig, Adapter, Sync, Login, Deployment):
> **`docs/architektur-entscheidungen.md`** (ADR-Stil).

> ✅ **Begonnen (29.06.2026):** `server/` angelegt (Fastify, 3 Schichten). Lauffähig **in-memory** +
> **Schein-DATEV-Adapter** (nichts hängt an DB/DATEV). Vorhanden: eigener **Login** (bcryptjs +
> Server-Session, httpOnly-Cookie), serverseitiges **Rollen-Gating**, **DATEV-Port** (austauschbar),
> **Sichtbarkeits-Filter**, Endpunkte `/api/health`, `/api/auth/*`, `/api/orders`.
>
> ✅ **Fortschritt (02.07.2026):** **Echter DATEVconnect-Adapter** (`DATEV_MODE=http`; Basic Auth,
> verifiziertes Feld-Mapping, getestet) und **MS-SQL-Grundlage** (`DB_MODE=mssql`): vollständiges
> Schema `server/db/schema.sql` (10 Tabellen, idempotent), Einricht-Skript `npm run db:setup`
> (Tabellen + erster Admin), Nutzer-Repository gegen MS SQL. **Prisma → `mssql`/tedious** (reines JS,
> keine Engine-Binärdateien; ADR-04-Änderungsvermerk). Dazu **NTLM-Anmeldung** im DATEV-Adapter +
> **lokale Entwicklungsumgebung** (ADR-13, `docs/entwicklungsumgebung.md`).
>
> ✅ **Fortschritt (03.07.2026):** **Alle Fach-Repositories** vollständig — Zeiten, Notes
> (+Kommentare), Board-Overlay, Checklisten, Status-Historie, Outbox, Anforderungen,
> Besonderheiten — jeweils als **Memory**- und **MS-SQL**-Variante hinter denselben Ports
> (`Repositories`-Bündel in `src/domain/ports.ts`; Verdrahtung per `DB_MODE` in `server.ts`).
>
> ✅ **Fortschritt (05.07.2026):** **Domain-Aktionen + API-Routen** für Zeit, Note und Status
> (`src/domain/actions/*`, `src/routes/{time,notes,status}.ts`). Rechte-/Workflow-Regeln
> serverseitig verbindlich: eigene Zeiten selbst freigeben (keine Partner-Freigabe, übertragene
> gesperrt), `notePolicy` (Frage vs. Review) gespiegelt, „Erledigt" durch Checklisten-Gate
> gesperrt, jeder Statuswechsel historisiert. Idempotenz bei Zeitbuchung; `DomainError`→HTTP-Status
> zentral. **75 Tests grün** (Aktionen + API-Integration).
>
> ✅ **Frontend-Anbindung Etappe 1:** Server-Modus (`npm run dev:api`), echter Login und Aufträge
> über das Board-Aggregat `GET /api/board` (`src/api/*`; Details in der Repo-`CLAUDE.md`).
>
> ✅ **Frontend-Anbindung Etappe 2:** Schreib-Aktionen für **Zeit/Notes/Status** an die API
> gekoppelt (`src/api/write.ts` + Endpunkte in `src/api/client.ts`). Muster: optimistisches lokales
> Update → API-Write → bei Neuanlagen Abgleich temporäre ↔ echte ID (Idempotenz-Key = temporäre ID);
> Fehler → Hinweisleiste (`syncError`/`SyncBanner`) + frischer `GET /api/board` (Revert). Verifiziert
> per Playwright im Server-Modus (buchen/freigeben/zurückziehen/löschen, Notiz, Statuswechsel je über
> einen Reload persistiert; Fehlerpfad mit Banner + Revert). **Nächste Schritte (Etappe 3):**
> Umplanung/Planung/Checklisten/Anforderungen/Besonderheiten/Suborders/Attachments + Nutzer-API als
> Frontend-Aktionen, DATEV-Outbox-Sync-Job.

- **Stack:** Node.js + TypeScript, **Fastify** (leichtgewichtig, gutes Schema/Validation), REST-API
  für die SPA. **MS SQL Server** (bestehende Instanz im ASP-Umfeld, eigene DB + eigener Benutzer);
  Zugriff über **`mssql`/tedious** (reines JS), Schema versioniert als idempotentes SQL
  (`server/db/schema.sql`, `npm run db:setup`).
- **Auth:** eigener Login (Session-Cookie **oder** JWT), Passwort-Hash (argon2/bcrypt), Rollen
  `mitarbeiter | partner` + Admin-Flag. **Jede sicherheitsrelevante Aktion serverseitig autorisiert.**
- **Persistenz-Schema (erste Skizze — im Bau verfeinern):**
  - `users` (Login, Rolle, Admin, `tagessoll`, `arbeitstage_pro_woche`, DATEV-`employee_id`).
  - `order_overlay` (App-Zusatzdaten je DATEV-Auftrag: 10er-Board-Status, Board-Position,
    Umplanungs-Kontingent). DATEV-Stammdaten **nicht** duplizieren — nur Overlay + Cache.
  - `outbox` (ausstehende Rückschreibungen mit Idempotenz-Schlüssel + Status `offen|uebertragen`;
    siehe ADR-06 in `architektur-entscheidungen.md`).
  - `time_entries` (Zeiten + `status erfasst|freigegeben|uebertragen`, `work_date`, Idempotenz-Key,
    DATEV-Buchungs-`id` nach Sync).
  - `notes` + `note_comments` + `attachments` (Storage-Key, MIME, Größe, Quarantäne-Status).
  - `status_history` (Audit aller Statuswechsel: wer/wann/von→nach).
  - `umplanungen` (Freigabe-Workflow), `checklist_templates` (je Ordertype), `ordertype_config`
    (Bucket/Farbe/Flags je Ordertype — löst Hardcode in `ordertypes.ts`/`art.ts` ab),
    `besonderheiten` (Schlüssel `client_id + ordertype`), `anforderungen` (aus Phase 0.1),
    `reminder_log`.
- **Domain-Layer:** validierte Funktionen `changeOrderStatus` / `validateTimeEntry` /
  Note-Aktionen **mit Actor-Kontext** (Rolle, zulässige Übergänge, Audit). Store/UI rufen
  ausschließlich diese — Migration der heute im Zustand-Store liegenden Regeln (P1.1/P1.5/P1.6).
- **Migration localStorage → DB:** der Mock-Store wird durch TanStack-Query-Hooks gegen die REST-API
  ersetzt; **Komponenten bleiben unverändert** (das war das M1-Designziel). Einmalige Übernahme von
  Checklisten-Vorlagen/Besonderheiten optional per Import.

---

## Phase 3 — DATEV-Adapter
- **Eigenes, abgeschottetes Modul** mit klarer Schnittstelle (`getOrders`, `getOrder`,
  `updateOrder`, `updateSuborder`, `getOrdertypes`, `getEmployees`, `postExpensePosting`, …),
  damit Sandbox/Live und ein späterer API-Wechsel austauschbar bleiben.
- **Read-Modify-Write** überall (PUT überschreibt vollständig): immer GET → mutieren → PUT.
- **Sync (Pull):** periodischer Job spiegelt Aufträge/Suborders/Ordertypes/Employees in den
  Cache/Overlay. **DATEV ist führend** — in DATEV gelöschte Aufträge → eigene Zusatzdaten
  **archivieren**, nicht hart löschen.
- **Writeback (Push):** Status/Plandaten/Verantwortliche (`PUT /orders`), Teilauftrag-Erledigt
  (`PUT …/suborders`), **freigegebene** Zeiten als `expensepostings` (mit Idempotenz/Dubletten-
  Schutz, danach Status `uebertragen`).

---

## Phase 4 — Betrieb & Restpunkte
- **E-Mail-Reminder-Job:** Aufträge ohne erfasste / mit nur `erfasst`-Zeiten; Eskalation an Partner.
  Auch der Auslöser für die Auftrags-Anforderung (Phase 0.1) ans Backoffice.
- **Deployment-Trennung** (P3.3): Produktiv über HTTPS/Reverse-Proxy, `vite host:true` ist Dev-Only.
- **Attachment-Konzept** (P2.4): Größenlimit, erlaubte Typen, server-seitige MIME/Extension-Prüfung,
  Virenscan/Quarantäne, Storage-Key statt freier URL, Berechtigung je Auftrag, Aufbewahrung/Löschung.
  (M1-Kleinfix offen: Object-URLs mit `URL.revokeObjectURL` freigeben.)
- **KI-Notizprüfung (V2):** `pruefeNotizKI` an `releaseTime` aktivieren (Prompt/Schwellen definieren).
- **Tests:** Komponenten-/E2E-Tests (RTL/Playwright) ergänzend zur bestehenden Vitest-Basis; CI läuft.

---

## Reihenfolge (Zusammenfassung)
```
Phase 0  Mock-Workflows (Anforderung + Umplanungs-Regeln)   ── jetzt, ohne Backend
Phase 1  DATEV-Spike (on-prem, Rest-Verifikation)           ── größtes Risiko zuerst
Phase 2  Backend-Gerüst (Auth, DB, Domain-Layer, Migration)
Phase 3  DATEV-Adapter (Sync Pull + Writeback Push)
Phase 4  Betrieb (Reminder, Deployment, Attachments, V2-KI)
```

## Was ich von dir noch brauche
1. **Phase 0.1:** eigenes Modul „Anforderungen" oder Knopf im Board-Kopf? In-App-Benachrichtigung?
2. **Phase 0.2:** Kontingent pro **Veranlagungsjahr** oder Kalenderjahr? Nur `ja`/`est`?
3. **Phase 1:** Zugang zur DATEVconnect-Instanz (Host/Port, technischer Benutzer) für den Spike —
   den führt jemand **on-prem** im Kanzleinetz aus; ich liefere Skript + Checkliste und werte aus.
