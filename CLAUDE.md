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
  Im Server-Modus füllt die eigene API-Schicht `src/api/*` den orders-Teil (Board-Aggregat +
  optimistische Schreib-Kopplung); UI-State (role, Filter, openCardId, Timer) bleibt lokal.
- Styling über CSS-Variablen aus `src/styles/tokens.css` (Marken-Tokens, keine Hardcode-Hex).

## Architektur-Leitplanken
- **Single Source of Truth `orders[]`**; alle Mutationen immutabel über das Order-Objekt
  (siehe `mapOrder`/`mapNote` im Store).
- **Status** ändert sich auf **zwei** Wegen: Drag & Drop (`Board.tsx`) **und** Status-Leiste im
  Detail (`OrderModal.tsx`). Beide rufen `setStatus`.
- **Rollen-Gating zentral** über `notePolicy` (Review-Notes/Fragen) **und** `rolePolicy`
  (Umplanung anfordern/freigeben, eigene Zeiten freigeben) — beide in `src/lib/tokens.ts`,
  nicht in der UI verstreuen.
- **Auftragsart-Identität = der DATEV-`ordertype`** (Kurz-Code, auch alphanumerisch wie `JAP`/`SAR`) —
  die einzige bebuchbare Ebene; am Auftrag als `Order.ordertype` modelliert. Der voll­ständige
  Live-Katalog liegt in `src/lib/ordertypes.ts` (`ORDERTYPES`, `ordertypeInfo`). Die `ordertype_group`
  ist nur **Klassifizierung** → als grober Farb-/Workflow-**Bucket** (`ArtKey`) genutzt: Mapping
  `ordertype_group_id → ArtKey` (`ORDERTYPE_GROUP_TO_ART`) plus ordertype-genaue „laufend"-Overrides
  (615/616 → `mehraufwand`, 601 → `lfd_beratung`) via `artKeyForOrdertype` — Keim der M2-Admin-Konfig.
  `art`/`artKey` am Auftrag sind **Projektionen** aus dem Ordertype (wie der DATEV-Import sie setzt).
  Farben als `--bk-art-*`-Tokens. Interne Gruppen (Verwaltung/Abwesenheit) sind nicht im Board.
- **Workflow-Flags am Ordertype** (nicht am Bucket!): `teilauftraege` (`'monat'`/`'quartal'`),
  `unterlagen` (Spalten `ua`/`uv`), `besonderheiten` — gepflegt im Ordertype-Katalog
  (`src/lib/ordertypes.ts`), abgefragt über `hasTeilauftraege`/`teilauftragRhythmus`/
  `hasUnterlagenProzess`/`hasBesonderheiten` in `src/lib/art.ts` (Argument = `order.ordertype`).
- **Spalten `ua`/`uv`** nur für Ordertypes mit Unterlagen-Prozess (`hasUnterlagenProzess`).
- **Checkliste je Auftragsart** über Vorlagen (`CHECKLIST_TEMPLATES`/`checklistFor` in
  `src/lib/checklists.ts`); „Erledigt" ist gesperrt bis vollständig (`canComplete` in
  `src/state/selectors.ts`), durchgesetzt in `OrderModal.tsx` **und** `Board.tsx`. Bedienung
  **nur im Auftrags-Detail**: Checkliste **und** Besonderheiten klappen dort als **Flyout** am
  jeweiligen Knopf aus (`CardFlyout` + `ChecklistBody`/`BesonderheitenBody`) — auf den
  Board-Karten bewusst nicht sichtbar (kompakte Kacheln).
- **Verhalten je Auftragsart** (Entscheidung 15.07.2026, `docs/zeiterfassung-board-konzept.md` §1):
  `verhaltenFor(ordertype)` in `src/lib/ordertypes.ts` liefert `planbar | laufend | sonstige |
  intern` (unbekannte Codes fail-safe `sonstige`; Grenzfall 614 dort dokumentiert umschaltbar).
  **Board/KPIs/Filterleiste/Planung/Controlling zeigen nur `planbar`** (`istPlanbar`, zentral in
  `useFilteredOrders`); **`sonstige` sind bebuchbar** über das Modul „Buchungen" (LaufendeView,
  eigener Abschnitt mit Suche) — nur nicht planbar. Keim der M2-Admin-Konfig.
- **Laufende Arten** (Beratung/Mehraufwand, `LAUFENDE_ARTEN`) nicht im Board, sondern im Modul
  „Buchungen" (Abschnitt „Laufende Buchungen") — Zeitbuchung mit Pflicht-Notiz (`artNeedsNotiz`).
  Schnellbuchung aus dem Auftrag heraus (`QuickTimeDialog`) bucht über Mandant+Art aufs passende
  laufende Order.
- **Teilaufträge** (ordertype-genau via `hasTeilauftraege`/`teilauftragRhythmus`): Monats- **oder**
  Quartals-Suborders am Order (`suborders[]`), „erledigt" via `setSuborderDone`
  (DATEV `date_work_completed`).
- **Freigaben** (Partner-Cockpit) und **Meine Zeiten** sind reine Sichten über `orders[]`
  (Selektoren `offeneUmplanungen`/`offeneReviewFreigaben`/`zeitenVon`). Das Partner-Cockpit umfasst
  **nur Umplanungen + Review-Notes** — **Zeiten brauchen keine Partner-Freigabe** (s. u.).
- **Persistenz:** Store via `persist` (localStorage, Key `bk-zeiterfassung`); `version` bei
  Änderungen am Order-Datenmodell erhöhen, damit der Mock neu seedet.
- **Mandantenbesonderheiten** am Schlüssel `besKey(mandantNr, ordertype)` (period-unabhängig, nicht
  am Order-Objekt; deckungsgleich mit DB-Design `clientId+ordertype` und `docs/datev-integration.md`)
  → automatische Übernahme in Folgeaufträge. Button nur für Ordertypes mit `besonderheiten`-Flag
  (`hasBesonderheiten`).
- **Controlling** ist eine reine Sicht über `orders[]` (Logik zentral in `src/state/selectors.ts`:
  `auslastungPct`, `istUeberfaellig`, `istNichtAbgerechnet`); **Planung** plant Aufträge per
  Drag & Drop ein (`planOrder`/`unplanOrder` setzen `monat`+`fristStart/Ende`; Monats-/Arbeitstags-
  Logik in `src/lib/monate.ts`). „Ungeplant" = leerer `monat`. Demo-Stichtag `HEUTE` und
  Demo-Kalenderhorizont `DEMO_KALENDER` (eine Quelle in `src/mock/orders.ts`, aus `HEUTE`
  abgeleitet) — von Planung **und** Umplanung (`OrderModal`) gemeinsam genutzt; in Produktion
  echtes Datum bzw. DATEV-Kapazität (`employeecapacities`).

## Fachliche Kernregeln (Details in `design_handoff_zeiterfassung/README.md`)
- **Geplanter Monat** aus EO-Datumsfeldern (`fristStart`/`fristEnde`).
- **Review Notes / Fragen** = Thread mit `kind` (`frage` = Mitarbeiter, `review` = Partner),
  `noteState` und optionalen Datei-**Anhängen** (`attachments`). Zwei Workflows:
  - **Frage** (`offen ↔ erledigt`): **keine Partner-Freigabe**. Der Mitarbeiter schließt selbst
    (`erledigt`), nimmt sie wieder auf oder stellt eine Rückfrage (Kommentar). Löschen: Mitarbeiter.
  - **Review** (`offen → erledigt → freigegeben`): Mitarbeiter meldet `erledigt`, der Partner gibt
    frei; Freigeben/Zurückgeben/Löschen: nur Partner.
  - Kommentieren/Bearbeiten/**Dateien anhängen**: beide. „Offen"-Zählung kind-bewusst über
    `noteOffen` (Frage zählt nur `offen`, Review bis `freigegeben`).
- **Zeiterfassung:** Live-Timer oder manuell; jeder Eintrag hat einen **Status**
  (`erfasst → freigegeben → uebertragen`, Typ `TimeStatus`). **Keine Partner-Freigabe** — der
  **Mitarbeiter** gibt seine eigenen Zeiten selbst frei (`releaseTime`/`withdrawTime`, in „Meine
  Zeiten" sowie in TimePanel/Laufende). Nur **freigegebene** Zeiten gehen in den DATEV-Sync (M2;
  `uebertragen` setzt erst der Sync als Aufwandsbuchung `POST …/expensepostings`). Das Arbeitsdatum
  (`datum` = DATEV `work_date`) ist maßgeblich, unabhängig vom Sync-Zeitpunkt. E-Mail-Reminder
  (Backend-Job, M2) für Aufträge ohne Zeit / mit noch nicht freigegebenen (`erfasst`) Zeiten.
- **Umplanung** in anderen Monat → grundsätzlich Freigabe-Anfrage an den Partner (Badge „Freigabe
  ausstehend"). **Ausnahme JA/ESt:** Erstplanung ist frei; `ja`/`est`-Aufträge dürfen **1× pro
  Veranlagungsjahr** ohne Freigabe umgeplant werden, danach gilt wieder die Partner-Freigabe.
  Zentral in `umplanungFreiMoeglich`/`umplanungRegelGilt` (`src/lib/regeln.ts`, re-exportiert aus
  `selectors.ts`) + Store-Action `umplanen` mit **Guard im Store** (Erstplanung und Ziel = aktueller
  Monat verbrauchen NICHTS; sonst zählt `Order.umplanungenVerbraucht` +1; `erzwungen` = Partner/
  Admin-Direktverschiebung, zählt wie Freigabe). `unplanOrder` (Partner/Admin) setzt zurück;
  Mitarbeiter-Zurücklegen nutzt `{ kontingentVerbrauchen: true }` — sonst wäre „Pool und neu
  ziehen" eine Freigabe-Umgehung. Durchgesetzt in `OrderModal` und `PlanungView` (beide über
  `rolePolicy`).
- **Auftrags-Anforderung** (Workflow, kein API-Write — DATEV kennt kein `POST /orders`): Knopf
  „Auftrag anfordern" im Board-Kopf (`KpiHeader`) → `AuftragsAnforderung` im Store
  (`angefordert → angelegt | abgelehnt`); Backoffice-Inbox in der Verwaltung (Admin). Sicht über
  `sichtbareAnforderungen` (eigene bzw. alle für Admin). M2: „angefordert" löst E-Mail aus,
  „angelegt" kommt per Sync.

## Konventionen / Definition of Done
- Entspricht `design_handoff_zeiterfassung/README.md` (Farben/Typo/Abstände) und dem Prototyp.
- Rollen-Regeln korrekt durchgesetzt; keine Emojis; Marken-Tokens statt Hardcode-Hex.
- `npm run typecheck` + `npm run lint` sauber.

## Roadmap
Meilenstein 1 (umgesetzt): klickbares Frontend mit Mock-Daten (`src/mock/orders.ts`).
Meilenstein 2 (begonnen): App-Backend in **`server/`** (Node+TS, Fastify) + **MS SQL Server**
(bestehende Instanz, eigene DB; Zugriff über **`mssql`/tedious** — reines JS, kein Prisma; Schema
versioniert in `server/db/schema.sql`, angewendet via `npm run db:setup`) + eigener Login,
DATEV-Adapter (DATEVconnect, Basic Auth) für Lesen + Rückschreibung, eigene Persistenz,
E-Mail-Reminder. Architektur-Entscheidungen: `docs/architektur-entscheidungen.md`; Fahrplan:
`docs/m2-plan.md`. DATEV-Mechanik (lesen, buchen, PUT) am Echtsystem verifiziert — auch **von
außerhalb des ASP** (`docs/datev-connect-handoff.md`, §12). Stand: echter HTTP-DATEV-Adapter
(`DATEV_MODE=http`, Basic + NTLM) und **alle Fach-Repositories** (Nutzer, Zeiten, Notes,
Board-Overlay, Checklisten, Status-Historie, Outbox, Anforderungen, Besonderheiten) als Memory-
**und** MS-SQL-Variante hinter denselben Ports (`Repositories` in `server/src/domain/ports.ts`,
Umschaltung per `DB_MODE`); Default bleibt in-memory + Schein-DATEV (Tests grün). Dazu
**Domain-Aktionen + API-Routen** für Zeit/Note/Status (`server/src/domain/actions/*`,
`server/src/routes/{time,notes,status}.ts`) mit serverseitig verbindlichem Rollen-/Workflow-Gating
(eigene Zeiten selbst freigeben, `notePolicy`, „Erledigt"-Checklisten-Gate, Status-Historie;
`DomainError`→HTTP zentral). **Frontend-Anbindung Etappe 1 umgesetzt:** Server-Modus per
`npm run dev:api` (`VITE_API_MODE=server` via `.env.api`, Vite-Proxy `/api`→3001) — echter Login
(`LoginView` → `/api/auth/login`, Session-Restore beim Start, Server-Logout) und Aufträge über
das Board-Aggregat `GET /api/board` (`server/src/domain/actions/board.ts`: Overlay + Zeiten +
Notes + Checkliste + Anzeige-Namen in einer Antwort). Frontend-Seite: `src/api/`
(`mode`/`client`/`types`/`mapping`/`session`) — DTO→`Order`-Mapping macht der Client
(art/artKey aus dem Ordertype, Monat aus `plannedEnd`); Store startet im Server-Modus leer,
persistiert keine Server-Daten (eigener Key `bk-zeiterfassung-api`). Demo-Modus (`npm run dev`)
bleibt unverändert. **Frontend-Anbindung Etappe 2 umgesetzt:** die Schreib-Aktionen für
Zeit/Notes/Status schreiben im Server-Modus serverseitig fest. Muster: der Store macht zuerst ein
**optimistisches** lokales Update, danach koppelt `src/api/write.ts` die Aktion an die API
(`src/api/client.ts`: `bookTime`/`releaseTime`/`withdrawTime`/`deleteTime`, `setStatus`,
`createNote`/`editNote`/`noteDone`/`noteReopen`/`noteApprove`/`commentNote`/`deleteNote`) — bei
Neuanlagen wird die temporäre Client-ID gegen die echte Server-ID getauscht (der Idempotenz-Key
der Buchung IST diese temporäre ID → kein Doppelbuchen bei Retry), der Zielzustand einer Note
mappt auf `done`/`approve`/`reopen`. Fehler landen in `syncError` (Hinweisleiste `SyncBanner`) und
lösen einen frischen `GET /api/board` aus, der das optimistische Update verwirft. Aktionen, deren
lokaler Guard strenger ist als der Server (ua/uv-Status, Löschen nur `erfasst`), feuern nur bei
tatsächlicher lokaler Änderung. Anhänge bleiben vorerst lokal. Demo-Modus unverändert (kein
`API_MODE` → keine API-Aufrufe). **Frontend-Anbindung Etappe 3 begonnen — Checklisten:** server-
seitige Domain-Aktion + Routen (`server/src/domain/actions/checklist.ts`,
`server/src/routes/checklist.ts`) für Abhaken/Hinzufügen/Entfernen (jeweils `requireVisibleOrder` +
Punkt-gehört-zum-Auftrag-Prüfung) — damit greift das serverseitige „Erledigt"-Gate (`canComplete`)
jetzt auf echte, persistierte Punkte. Instanziierung: das Frontend seedet die Checkliste beim ersten
Öffnen einmalig aus den (admin-gepflegten) Vorlagen-Labels über `POST …/checklist/ensure`, der
Server legt sie **idempotent** an (nur wenn noch keine existieren; In-Flight-Schutz im Client gegen
Doppel-Seed). Store-Aktionen `toggleCheck`/`addCheck`/`removeCheck`/`ensureChecklist` sind wie in
Etappe 2 optimistisch an `src/api/write.ts` gekoppelt. **Codex-Review-Fixes Server-Modus
(umgesetzt):** (1) Produktions-Fail-Fast in `server/src/config.ts` — `NODE_ENV=production`
verlangt `DB_MODE=mssql` (Memory-Modus seedet Demo-Nutzer). (2) Zentraler Helper `heute()`
(`src/lib/heute.ts`): Demo = Stichtag `HEUTE`, Server-Modus = echtes Tagesdatum — einzige Quelle
für Arbeitsdatum von Buchungen, „Heute erfasst", Überfällig-Stichtag, VJ-Default. (3) **Zeit-
Ownership:** `TimeEntry.userId` (Server-Modus; Demo-Fallback über Auftrags-Bearbeiter) — „Meine
Zeiten" (`zeitenVon`) und Freigeben/Zurückziehen/Löschen laufen über `istEigeneZeit`
(`selectors.ts`); der Server erzwingt Ownership ohnehin. (4) **Planung im Server-Modus:** eigene
Planungs-ID aus `me.datevId`, Admin-Auswahl aus den sichtbaren Aufträgen (distinct Bearbeiter),
Kalenderhorizont aus `heute()` — Demo weiter über Mock-`EMPLOYEES`. (5) **„Erledigt"-Gate nicht
mehr umgehbar:** die Status-Aktion seedet vor der Gate-Prüfung idempotent die server-seitige
Default-Vorlage (`server/src/domain/checklistTemplates.ts`, Spiegel der Frontend-Defaults;
gemeinsame Mechanik `seedChecklist` in `actions/checklist.ts`) — ein Board-Drag auf „Erledigt"
vor dem ersten Öffnen wird abgelehnt und die Pflichtpunkte existieren danach.
**Review-Arbeitsauftrag 12.07.2026 (umgesetzt, alle 3 Prioritäten;
`docs/reviews/2026-07-12-codereview-arbeitsauftrag.md`):** (P1) Zeiten löschen nur im Status
`erfasst`; Checklisten-**Herkunft** `vorlage` (Pflichtpunkt, nie löschbar — UI ohne Lösch-Knopf,
Server lehnt ab) vs. `manuell` (löschbar als revisionssicherer **Soft-Delete**
`deletedAt`/`deletedBy`, Server-Zeit; aktive Listen + „Erledigt"-Gate sehen nur aktive Punkte;
fehlende Herkunft gilt fail-safe als `vorlage`). (P2) zentrale Eingabegrenzen
`server/src/domain/limits.ts` (Kalenderprüfung, Dauer max. **12 h/Tag** — Fachregel 12.07.2026,
je Einzelbuchung UND als Tagessumme je Nutzer über alle Aufträge (`sumByUserAndDate`), 2
Nachkommastellen, Längen wie DB-Schema) in Domain UND Routen; Idempotenz nur bei gleichem Nutzer+Nutzlast (sonst 403/409,
Parallelfall kontrolliert); Statuswechsel atomar über `repos.statusTransaktion.commitStatusWechsel`
(MSSQL-Transaktion, Outbox-fähig). (P3) Login-Fehlversuchs-Sperre (`auth/loginSchutz.ts`, 5→15 Min.)
+ Protokoll; Deaktivierung wirkt sofort (`User.active`, Repos filtern); versionierte
**DB-Migrationen** (`server/db/migrations/` + `schema_migrations`; Checklisten-Änderung =
Migration 001); eigenes Server-ESLint + CI-Schritt; `npm run coverage`; E2E-Suiten reproduzierbar
in `tools/e2e/`. Als Nächstes
(Etappe 3): restliche Aktionen (Umplanung/Planung/Anforderungen/Besonderheiten/Suborders/
Attachments/Nutzer-API), Checklisten-Vorlagen serverseitig verwalten (löst die bewusste
Vorlagen-Duplikation ab) + DATEV-Outbox-Sync-Job.
