# Kritischer Code-, Lastenheft- und Security-Review vom 17.07.2026

## 1. Management Summary

**Gesamtbewertung: weiterhin nicht produktionsreif und nicht vollständig lastenheftkonform.**

Der geprüfte Stand ist ein überzeugender M1-Prototyp mit einem substanziellen, gut strukturierten
M2-Backend. Die seit dem Review vom 16.07.2026 hinzugekommenen Änderungen verbessern die
DATEV-Leseperformance, korrigieren den Teilauftrags-Chip und ergänzen ein grafisches
Zeiterfassungs-Board. Typecheck, Lint, Builds sowie alle 182 Unit-/Integrationstests sind grün.

Die fünf wesentlichen Produktionsblocker des vorherigen Reviews bestehen jedoch unverändert:

1. Das serverseitige Checklisten-Gate lässt sich mit einer beliebigen oder zuvor manuell
   angelegten Ein-Punkt-Liste umgehen.
2. Der zentrale DATEV-Writeback für Status, Planung, Verantwortliche, Teilaufträge und
   freigegebene Zeiten fehlt. Die echte DATEV-Teilauftrags-ID wird weiterhin verworfen.
3. Pflichtnotiz, Aufwandsart und Teilauftragszuordnung werden nur im Browser, nicht in der
   verbindlichen Server-Domain erzwungen.
4. Die 12-Stunden-Tagesgrenze ist bei parallelen Requests nicht atomar.
5. `npm audit --omit=dev` meldet weiterhin hohe Schwachstellen in Frontend- und
   Backend-Produktionsabhängigkeiten.

Neu bzw. durch die Änderungen seit 16.07.2026 hinzugekommen:

- Das neue Zeiterfassungs-Board verwendet fest 8 Stunden als Tagessoll, obwohl Nutzerprofile
  andere Sollzeiten enthalten. Uhrzeitpositionen werden nicht serverseitig gespeichert und ändern
  sich nach Reload; Überlappungen und Blöcke außerhalb der Timeline werden nicht verhindert.
- Der Login-Schutz verwendet `req.ip`, Fastify ist aber nicht für den dokumentierten Reverse Proxy
  konfiguriert. Hinter dem Proxy teilen damit alle Nutzer denselben IP-Schlüssel und können
  gemeinsam für 15 Minuten ausgesperrt werden.
- Das neue Abnahmedrehbuch beschreibt E2E-Suiten als automatisiert und „vor jedem Push grün“,
  während deren eigene README sie ausdrücklich als manuell und nicht in CI eingebunden bezeichnet.

**Freigabeempfehlung:** Demo und Weiterentwicklung ja; Pilot mit Echtdaten und Produktivbetrieb
nein, bis mindestens alle P1-Befunde sowie die serverseitige Persistenz der Kernworkflows behoben
und live abgenommen sind.

## 2. Prüfungsumfang

Geprüfter Stand: Commit `82631d6` auf Branch `claude/magical-gauss-3h604n`, Arbeitsbaum vom
17.07.2026.

Seit dem vorherigen Review-Stand `0c3ab38` wurden vier Commits geprüft:

- DATEV-Auftragscache und Warm-up beim Serverstart,
- Korrektur des Teilauftrags-Chips,
- neues grafisches Zeiterfassungs-Board,
- neues Abnahmedrehbuch und E2E-Skript für die Zeiterfassung.

Der versionierte Codeumfang beträgt derzeit rund **12.403 Zeilen in 133 Dateien** der Typen
TypeScript/TSX/CSS/SQL/MJS: 6.690 Frontend-, 5.038 Backend-, 484 Tool-/E2E- und 191 sonstige
Codezeilen. Generierte Dateien und `node_modules` sind nicht enthalten.

Herangezogene Soll- und Ist-Quellen:

- `docs/lastenheft.md`
- `AGENTS.md` als aktueller verbindlicher Projektkontext
- `design_handoff_zeiterfassung/README.md`
- `docs/m2-plan.md` und `docs/architektur-entscheidungen.md`
- Frontend unter `src/`
- Backend, Schema und Migrationen unter `server/`
- CI-Konfiguration und Test-/E2E-Skripte

Vorhandene lokale Änderungen und unversionierte Dateien wurden nicht verändert. Nicht ausgeführt
wurden Live-Schreibtests gegen DATEV, Tests gegen eine echte MS-SQL-Instanz und die manuellen
Playwright-Suiten. Aussagen zu DATEV und MS SQL sind daher Codepfad-Bewertungen, keine
Echtsystem-Abnahme.

### 2.1 Maßstab bei widersprüchlichen Anforderungen

Das ältere Lastenheft und die jüngeren verbindlichen Entscheidungen widersprechen sich an einigen
Stellen. Für diesen Review gilt der jüngere Projektkontext:

| Thema | Älteres Lastenheft | Aktuelle verbindliche Entscheidung | Review-Maßstab |
|---|---|---|---|
| Zeitfreigabe | Partner gibt Zeiten frei | Mitarbeiter gibt eigene Zeiten selbst frei | Selbstfreigabe |
| Partner-Cockpit | Enthält auch Zeiten | Nur Umplanung und Review-Notes | Zeiten nur in „Meine Zeiten“ |
| Checkliste | Auch auf Board-Karten bedienbar | Bedienung nur im Auftragsdetail | Detail-only |
| Umplanung JA/ESt | Teilweise widersprüchliche Kurzform | Erstplanung frei, danach einmal je VJ frei | zentrale Regel in `regeln.ts` |

Das Lastenheft sollte bereinigt werden, damit eine spätere formale Abnahme nicht gegen zwei
verschiedene Sollstände erfolgt.

## 3. Änderungen seit dem letzten Review

Positiv festgestellt:

- Der DATEV-Adapter cached den großen `expand=suborders`-Abruf 60 Sekunden und dedupliziert
  parallele Abrufe (`server/src/datev/httpAdapter.ts:109-117`, `202-220`). Das reduziert die
  zuvor beobachtete Wartezeit auf DATEV-Seite.
- Der Server wärmt den Auftragscache nach erfolgreichem Healthcheck im Hintergrund vor
  (`server/src/server.ts:31-55`).
- Der Teilauftrags-Chip wird nur noch für Ordertypes mit echtem Teilauftrags-Flag angezeigt
  (`src/features/board/OrderCard.tsx`).
- Das Zeiterfassungs-Board nutzt die bestehende Buchungskette und setzt im Demo-Modus nun korrekt
  den buchenden Nutzer als Owner (`src/state/store.ts:371-388`).
- Die Qualitätsgates blieben trotz der neuen Funktion grün.

Die Performanceverbesserung betrifft allerdings nur den DATEV-Listenabruf. Das nachgelagerte
Board-Aggregat führt weiterhin pro sichtbarem Auftrag mehrere Datenbankabfragen aus; siehe P2-6.

## 4. Priorisierte Befunde

Prioritäten:

- **P1:** vor Pilot-/Produktivbetrieb zwingend beheben; fachliche Integrität oder Security betroffen.
- **P2:** vor fachlicher Abnahme beheben; relevante Fehler, Rechte- oder Betriebsrisiken.
- **P3:** Härtung, Wartbarkeit oder fehlender belastbarer Nachweis.

### P1-1 – Checklisten-Pflichtpunkte und „Erledigt“-Gate sind serverseitig umgehbar

**Feststellung**

Jeder angemeldete Nutzer mit Zugriff auf einen Auftrag darf beim ersten `checklist/ensure`
beliebige Labels als Pflichtvorlage an den Server schicken. Alternativ kann er vorher einen
manuellen Punkt anlegen. Sobald irgendein aktiver Punkt existiert, beendet `seedChecklist` das
Seeding und ergänzt die echten Default-Pflichtpunkte nicht. Nach Abhaken des trivialen Punkts kann
der Auftrag auf `er` gesetzt werden.

**Codebeleg**

- Die Route nimmt Client-Labels entgegen: `server/src/routes/checklist.ts:12-20`.
- `ensure` prüft nur Auftragssichtbarkeit, nicht Adminrecht oder Vorlagenidentität:
  `server/src/domain/actions/checklist.ts:55-64`.
- Bereits ein vorhandener Punkt beendet das Seeding: `server/src/domain/actions/checklist.ts:25-39`.
- Ein normaler Nutzer darf vorab manuelle Punkte anlegen:
  `server/src/domain/actions/checklist.ts:67-79`.
- Die Statusaktion verwendet denselben Seed und prüft danach nur `every(done)`:
  `server/src/domain/actions/status.ts:44-52`, `server/src/domain/rules.ts:11-12`.

**Warum das ein Fehler ist**

Die Checkliste soll das Erledigen eines Auftrags verbindlich sperren. Der Server akzeptiert aber
eine vom zu schützenden Client selbst definierte, verkürzte Soll-Liste. Damit ist das Gate keine
serverseitige Sicherheitsgrenze.

**Empfehlung**

- Pflichtvorlagen ausschließlich serverseitig versioniert verwalten.
- Das normale `ensure` darf keine Labels vom Browser als Pflichtpunkte übernehmen.
- Fehlende Pflichtpunkte anhand stabiler Vorlagenpunkt-IDs ergänzen und beim Gate explizit prüfen.
- Negativtests für verkürzte/leere Labels, manuellen Punkt vor Seed und paralleles Ensure ergänzen.

### P1-2 – DATEV-Writeback ist nicht umgesetzt; Teilauftrags-ID fehlt im Modell

**Feststellung**

Aufträge, Teilaufträge und Mandanten werden aus DATEV gelesen. Status, Plandaten,
Verantwortliche und Teilauftragserledigungen werden aber nicht zurückgeschrieben. Die Freigabe
einer Zeit setzt nur den lokalen DB-Status; sie erzeugt keinen Outbox-Eintrag. Der vorhandene
`postExpensePosting`-Adapter wird von keinem Produktivpfad aufgerufen.

Zusätzlich verwirft das DATEV-Mapping die echte `suborder.id` und behält nur
`suborder_number`. Das Frontend verwendet diese Nummer als `Suborder.id`, während der DATEV-POST
die echte Teilauftrags-ID im URL-Pfad verlangt.

**Codebeleg**

- `DatevPort` besitzt kein `updateOrder`/`updateSuborder`:
  `server/src/domain/ports.ts:148-155`.
- Statuswechsel übergibt keinen Outbox-Eintrag:
  `server/src/domain/actions/status.ts:61-68`.
- Zeitfreigabe aktualisiert nur das Repository:
  `server/src/domain/actions/time.ts:125-132`.
- `server/src/server.ts:15-62` startet weder Outbox- noch Reminder-Worker.
- Das Suborder-Mapping behält nur `suborder_number`:
  `server/src/datev/httpAdapter.ts:39-48`, `server/src/domain/types.ts:84-94`.
- Das Frontend setzt `id: String(s.number)`: `src/api/mapping.ts:75-82`.
- Der DATEV-POST benötigt `p.suborderId` im URL-Pfad:
  `server/src/datev/httpAdapter.ts:247-260`.

**Warum das ein Fehler ist**

Die Rückschreibung nach EO Comfort ist Kernbestandteil des Lastenhefts. Ohne durchgängigen
Writeback laufen App- und DATEV-Stand auseinander; eine später ergänzte Buchungsroutine kann mit
der aktuellen Modellierung den korrekten DATEV-Teilauftrag nicht sicher adressieren.

**Empfehlung**

- Echte DATEV-Teilauftrags-ID durch Domain-, DTO- und Frontendmodell führen.
- Read-Modify-Write für Auftrag und Teilauftrag in `DatevPort` ergänzen.
- Outbox atomar an Status, Planung, Umplanung, Teilauftrag und Zeitfreigabe koppeln.
- Idempotenten Worker mit Retry, Fehlerstatus, Monitoring und Live-Roundtrip-Tests implementieren.

### P1-3 – Pflichtnotiz, Aufwandsart und Teilauftragszuordnung fehlen serverseitig

**Feststellung**

Die UI verlangt für laufende Beratung/Mehraufwand eine Notiz und teilweise eine Aufwandsart.
Route und Domain führen `notiz`, `aufwandsart` und `suborderId` jedoch optional. Die Domain lädt
den Auftrag nur zur Sichtbarkeitsprüfung und wertet den Ordertype danach nicht aus.

**Codebeleg**

- Optionale API-Felder: `server/src/routes/time.ts:10-17`.
- Nach `requireVisibleOrder` werden nur Dauer, Datum und Notizlänge geprüft:
  `server/src/domain/actions/time.ts:62-73`.
- Die optionalen Werte werden unverändert gespeichert:
  `server/src/domain/actions/time.ts:96-107`.
- Die Pflichtnotizregel existiert nur im Frontend: `src/lib/art.ts:53-55` und
  `src/features/zeiterfassung/ZeiterfassungBoard.tsx:96-100`.

**Warum das ein Fehler ist**

Ein direkter API-Aufruf oder fehlerhafter Client kann Buchungen erzeugen, die die Oberfläche
verbietet und die später nicht eindeutig bzw. nicht vollständig nach DATEV übertragen werden
können. Das verletzt die Architekturentscheidung „Server entscheidet“.

**Empfehlung**

Ordertype-basierte Buchungsregeln in die Server-Domain übernehmen, Teilauftragszugehörigkeit gegen
den geladenen Auftrag prüfen und Negativtests für alle Pflichtkombinationen ergänzen.

### P1-4 – 12-Stunden-Tagesgrenze ist nicht nebenläufigkeitsfest

**Feststellung**

Die Tagesgrenze wird mit einer Summenabfrage geprüft und anschließend in einem getrennten Request
gespeichert. Zwei parallele Buchungen mit verschiedenen Idempotenzschlüsseln können dieselbe alte
Summe sehen und zusammen mehr als zwölf Stunden einfügen.

**Codebeleg**

- Getrennte Summe und Insert: `server/src/domain/actions/time.ts:83-110`.
- MSSQL-Summe und Insert laufen ohne gemeinsame Transaktion/Sperre:
  `server/src/infra/mssql/times.ts:49-60`, `83-91`.
- Die vorhandene Parallelbehandlung betrifft nur denselben Idempotenzschlüssel, nicht die
  Tagessumme: `server/src/domain/actions/time.ts:109-120`.

**Empfehlung**

Prüfung und Insert in einer MSSQL-Transaktion mit passender Isolation/Locking ausführen oder eine
transaktionale Nutzer-Tag-Aggregatzeile verwenden. Einen echten Paralleltest mit unterschiedlichen
Schlüsseln ergänzen.

### P1-5 – Hohe Schwachstellen in Produktionsabhängigkeiten

Die Audits vom 17.07.2026 schlagen in beiden Paketen fehl.

**Frontend**

- `xlsx` ist eine direkte Produktionsabhängigkeit und laut Audit von Prototype Pollution
  ([GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6)) und ReDoS
  ([GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)) betroffen.
- Das Paket verarbeitet tatsächlich hochgeladene Admin-Dateien im Checklistenimport.
- `npm audit` bietet für das installierte npm-Paket keinen automatischen Fix an.

**Backend**

- Der Audit meldet sieben hohe betroffene Paketknoten, darunter das direkte `fastify`, `httpntlm`
  sowie transitiv `fast-uri`, `fast-json-stringify` und `underscore`.
- Relevante Advisories sind unter anderem Fastify Content-Type Validation Bypass
  ([GHSA-jx2c-rxcm-jvmq](https://github.com/advisories/GHSA-jx2c-rxcm-jvmq)), zwei `fast-uri`-
  Schwachstellen ([GHSA-q3j6-qgpj-74h6](https://github.com/advisories/GHSA-q3j6-qgpj-74h6),
  [GHSA-v39h-62p7-jpjc](https://github.com/advisories/GHSA-v39h-62p7-jpjc)) und ein Underscore-DoS
  ([GHSA-qpx9-hpmf-5gmw](https://github.com/advisories/GHSA-qpx9-hpmf-5gmw)).

Nicht jeder transitive Befund ist im aktuellen Nutzungspfad automatisch ausnutzbar. Für eine
Produktionsfreigabe reicht diese Annahme aber nicht; Upgrade, Ersatz oder dokumentierte und
getestete Nicht-Ausnutzbarkeit sind erforderlich.

**Empfehlung**

- Fastify-5-Upgrade inklusive Plugin-/Schema-Kompatibilität testen.
- `xlsx` ersetzen oder aus einer gepflegten behobenen Quelle beziehen; Datei- und Zeilenlimits
  ergänzen.
- `httpntlm`/Underscore ersetzen oder kontrolliert patchen.
- `npm audit --omit=dev` als CI-Gate mit dokumentiertem Ausnahmeprozess aufnehmen.

### P2-1 – Neues Zeiterfassungs-Board bildet Sollzeit und Uhrzeit nicht verlässlich ab

**Feststellung**

Das Board verwendet global `TAGES_SOLL = 8`, obwohl Nutzerprofile beispielsweise 6 Stunden
enthalten (`src/mock/users.ts:19`) und die Planung das individuelle Tagessoll bereits nutzt
(`src/features/planung/PlanungView.tsx:67-71`). Damit zeigt die Zeiterfassung für Teilzeitkräfte
eine falsche Prozentzahl und eine falsche „Tag voll?“-Aussage.

`startMin` wird absichtlich nicht an den Server gesendet. Nach einem Reload werden Buchungen ab
07:00 Uhr in Listenreihenfolge gestapelt. Die sichtbare Uhrzeit ist damit kein persistierter
Sachverhalt. Zusätzlich kann der Plus-Stepper einen Block beliebig über 20:00 Uhr hinaus verlängern;
Überlappungen mit vorhandenen Buchungen werden nicht erkannt.

**Codebeleg**

- Festes Tagessoll: `src/features/zeiterfassung/ZeiterfassungBoard.tsx:24-29`, `81-83`, `130-133`.
- Server-Reload verändert die Position ausdrücklich:
  `src/features/zeiterfassung/ZeiterfassungBoard.tsx:20-21`, `68-79`.
- `startMin` bleibt nur im lokalen Store und geht nicht an `write.bookTime`:
  `src/state/store.ts:371-388`.
- Dauererhöhung hat keine Ober-/Timelinegrenze:
  `src/features/zeiterfassung/ZeiterfassungBoard.tsx:167-179`.
- Der Server kennt nur Datum und Dauer: `server/src/routes/time.ts:10-18`.

**Warum das ein Fehler ist**

Das zentrale Versprechen der Ansicht sind sichtbare Lücken und „Tag voll?“. Beides kann nach
Reload oder bei Teilzeit falsch sein. Eine reine Anzeige-Uhrzeit darf nicht wie belastbare
Arbeitszeitlage wirken, wenn sie nicht dauerhaft gespeichert wird.

**Empfehlung**

- Nutzer-Tagessoll und Arbeitstageprofil verwenden; im Servermodus aus einer Nutzer-API laden.
- Entweder Start-/Endzeit in der App-DB persistieren oder die Ansicht klar als reine
  Reihenfolgen-/Daueransicht ohne Uhrzeitposition gestalten.
- Timelinegrenzen und Überlappungsverhalten fachlich festlegen und validieren.
- Komponenten-/E2E-Tests für Teilzeit, Reload, Überlappung und Tagesende ergänzen.

### P2-2 – `ua`/`uv` kann per API für jede Auftragsart gesetzt werden

Der Frontend-Store blockiert Unterlagenstatus für Ordertypes ohne Unterlagenprozess. Die
Serveraktion prüft dagegen nur, ob die Status-ID bekannt ist
(`server/src/domain/actions/status.ts:24-39`). Ein direkter API-Aufruf kann deshalb einen
fachlich ungültigen Boardstatus erzeugen.

**Empfehlung:** Ordertype-Workflowregeln serverseitig spiegeln und Negativtests für `ua`/`uv`
ergänzen.

### P2-3 – Optimistische Neuanlagen haben Temp-ID-Races

Zeit, Note, Kommentar und Checklistenpunkt erscheinen zunächst unter einer temporären Client-ID.
Die asynchrone Serverantwort tauscht diese später aus; die Store-Aktionen sind ausdrücklich
„feuern und vergessen“ (`src/api/write.ts:19-20`, `38-80`). Eine sofortige Folgeaktion kann daher
mit einer auf dem Server unbekannten ID gesendet werden (`src/api/write.ts:85-127`).

**Auswirkung:** sporadische 404-Fehler, Board-Reload und Verlust der optimistischen Folgeaktion bei
langsamer Verbindung oder schnellem Klicken.

**Empfehlung:** abhängige Aktionen bis zur Bestätigung sperren/queueen oder eine vom Client
erzeugte und serverseitig übernommene Datensatz-ID verwenden; Race-Tests ergänzen.

### P2-4 – Admin-only-Verwaltung ist nur in der Navigation geschützt

Die Topbar versteckt den Verwaltungs-Tab für Nicht-Admins. `App` rendert die Verwaltung aber allein
anhand des lokalen Modulzustands (`src/App.tsx:24-25`, `71`). Der Zustand bleibt bei Logout/Login im
gemounteten `App` erhalten. Meldet sich nach einem Admin ein Nicht-Admin an, kann die Ansicht damit
weiter sichtbar bleiben.

Im Servermodus behält `hydrate` außerdem alte Nutzerobjekte, und `apiLogout` leert `users` nicht
(`src/api/session.ts:12-21`, `43-50`). Eine serverseitige Nutzer-API existiert noch nicht, aber die
UI-Sichtbarkeitsregel und Sitzungstrennung sind bereits verletzt.

**Empfehlung:** Render-Gate mit aktuellem `isAdmin`, Modulreset bei Rechteverlust und vollständiges
Leeren sitzungsbezogener Daten. Jede künftige Verwaltungs-API zusätzlich serverseitig absichern.

### P2-5 – DATEV-Initialstatus wird pauschal zu `av`

Der DATEV-Adapter liest `completion_status` (`server/src/datev/httpAdapter.ts:51-58`). Ohne
App-Overlay ignoriert das Frontend diesen Wert und setzt unbekannt/leer immer auf Arbeitsvorrat
(`src/api/mapping.ts:37-40`). Bereits in DATEV bearbeitete oder erledigte Aufträge können dadurch
in der falschen Spalte starten.

**Empfehlung:** fachliches Roundtrip-Mapping für alle zehn Status definieren, serverseitig umsetzen
und unbekannte Werte sichtbar markieren statt still `av` zu verwenden.

### P2-6 – Board-Aggregat erzeugt weiterhin N+1-MSSQL-Abfragen

Der neue DATEV-Cache beseitigt den wiederholten großen Remote-Abruf, nicht aber die lokale
Abfragezahl. Das Board lädt pro sichtbarem Auftrag Zeiten, Notes und Checkliste separat und danach
pro Note noch einmal Kommentare (`server/src/domain/actions/board.ts:65-89`). Bei tausenden
Aufträgen entstehen weiterhin sehr viele SQL-Requests.

**Empfehlung:** sichtbare Order-IDs gesammelt an Batch-Repositories übergeben, Kommentare in
wenigen Abfragen laden und Pagination/Zeitraumfilter ergänzen. Lasttest gegen realistische
Auftragsmengen durchführen.

### P2-7 – DATEV-Aufrufe haben kein Timeout; tiefer Healthcheck ist anonym

Weder `fetch` noch der NTLM-Pfad besitzen ein hartes Verbindungs-/Antworttimeout
(`server/src/datev/httpAdapter.ts:127-180`). Ein hängender DATEV-Dienst kann Requests und den
Warm-up dauerhaft binden. `/api/health/datev` ist ohne Authentifizierung erreichbar und löst einen
echten DATEV-Aufruf aus (`server/src/routes/health.ts:4-6`).

**Empfehlung:** Timeout/Abort, begrenzte Retries und Circuit Breaker ergänzen. Öffentlich nur einen
billigen Liveness-Check anbieten; tiefen DATEV-Check authentifizieren, cachen oder intern halten.

### P2-8 – Kernfunktionen bleiben im Servermodus nur lokal im Browser

Nur Status, Zeiten, Notes und Checklisten sind an die Server-Schreibschicht gekoppelt. Planung,
Umplanung, Verantwortliche, Teilauftragserledigung, Anforderungen, Besonderheiten,
Checklisten-Vorlagen, Nutzerverwaltung und Attachments bleiben lokale Store-Aktionen. Im
Servermodus werden Besonderheiten, Vorlagen und Anforderungen sogar weiter in `localStorage`
persistiert (`src/state/store.ts:586-612`).

**Warum das problematisch ist**

Die UI vermittelt persistente Fachfunktionen, tatsächlich sind die Daten browser- und
arbeitsplatzgebunden. Sie gehen beim Browserwechsel verloren und können nach Logout auf gemeinsam
genutzten Arbeitsplätzen zurückbleiben.

**Empfehlung:** unfertige Aktionen im Servermodus eindeutig deaktivieren oder vollständig über
autorisierte Serveraktionen anbinden. Keine fachlich relevanten Produktivdaten ausschließlich in
`localStorage` halten.

### P2-9 – Login-IP-Schutz kollidiert mit dem vorgesehenen Reverse Proxy

Die Architektur verlangt Produktion über HTTPS/Reverse Proxy
(`docs/architektur-entscheidungen.md:206`). Fastify wird jedoch ohne `trustProxy` erstellt
(`server/src/app.ts:25-28`), während der Login-Schutz `req.ip` verwendet
(`server/src/routes/auth.ts:27-54`). Hinter einem Reverse Proxy ist `req.ip` daher typischerweise
die Proxy-Adresse. Fünf Fehlversuche eines Nutzers sperren dann den gemeinsamen IP-Schlüssel und
damit sämtliche Kanzleinutzer hinter diesem Proxy für 15 Minuten.

Zusätzlich werden Login-Schutz-Einträge mit ein bis vier Fehlversuchen und `gesperrtBis = 0` nie
zeitbasiert entfernt (`server/src/auth/loginSchutz.ts:31-50`). Bei vielen wechselnden Namen/IPs
kann die Map dauerhaft wachsen.

**Empfehlung**

- `trustProxy` ausschließlich für konkret vertrauenswürdige Proxy-Adressen konfigurieren; keine
  pauschale Übernahme beliebiger `X-Forwarded-For`-Header.
- IP- und Kontolimits getrennt fachlich dimensionieren.
- Einträge mit TTL, periodischem Sweep und maximaler Map-Größe verwalten.
- Integrationstest mit realistischem Proxy-Header-/Socket-Szenario ergänzen.

### P3-1 – Audit-Historie deckt nur einen Teil der fachlichen Änderungen ab

Statuswechsel werden historisiert, Checklistenlöschungen besitzen Soft-Delete-Metadaten.
Zeitbuchung, Freigabe, Zurückziehen und Löschen sowie Note-Workflowänderungen haben aber keine
vollständige unveränderliche Auditspur. Vor Produktivbetrieb sollte festgelegt werden, welche
Aktionen revisionspflichtig sind, und Akteur, Zeitpunkt, Vorher-/Nachherzustand sowie
Korrelations-ID sollten dauerhaft gespeichert werden.

### P3-2 – Security-Header, Eingabegrenzen und Konfigurationsvalidierung sind unvollständig

- Es ist kein `@fastify/helmet` bzw. keine äquivalente zentrale Headerkonfiguration registriert
  (`server/src/app.ts:25-44`).
- Login-Username und Passwort haben keine Obergrenze (`server/src/routes/auth.ts:8-11`).
- Fachlich passende kleinere Bodylimits je Route fehlen.
- Port, Session-TTL und DB-Port werden mit `Number(...)` übernommen, ohne positiv/endlich zu
  validieren (`server/src/config.ts:95-120`). Der Testlauf erzeugte passend dazu eine
  `TimeoutNegativeWarning`, ohne dass Tests fehlschlugen.

Vor externer oder breiter interner Bereitstellung sind CSP/Frame-/MIME-/Referrer-Header,
Größenlimits und Konfigurations-Fail-Fast zu ergänzen.

### P3-3 – E2E- und Security-Nachweise werden im Abnahmedokument überzeichnet

`docs/testdrehbuch-abnahme.md:9-12` bezeichnet die Playwright-Suiten als automatisiert und „vor
jedem Push grün“. Die E2E-README sagt dagegen ausdrücklich, dass sie manuell gestartet werden und
kein CI-Bestandteil sind (`tools/e2e/README.md:1-5`). Die CI führt nur Typecheck, Lint, Unittests und
Build aus (`.github/workflows/ci.yml:17-21`, `38-41`). Auch `npm audit` ist kein CI-Gate.

Das ist kein Laufzeitfehler, aber ein Abnahmerisiko: Das Dokument vermittelt einen stärkeren
Nachweis als tatsächlich reproduzierbar vorhanden.

**Empfehlung:** Formulierung korrigieren oder E2E-Suiten samt Browser/Server-Setup in CI aufnehmen;
Ausführungsdatum und Commit der letzten erfolgreichen manuellen E2E-Abnahme dokumentieren.

## 5. Vollständiger Lastenheft-Abgleich

Statuswerte: **Erfüllt**, **Teilweise**, **Fehlt**. „Erfüllt“ bedeutet im geprüften Codepfad und
ersetzt keine Live-Abnahme gegen DATEV/MS SQL.

| Anforderung | Status | Begründung / verbleibende Lücke |
|---|---|---|
| Eigener Login, Rollen Mitarbeiter/Partner, Admin-Zusatzrecht | Teilweise | Session-Cookie, bcrypt, Fehlversuchssperre und aktive Nutzerprüfung vorhanden. Nutzer-CRUD, Reset/Einladung, persistenter Sessionstore und Proxy-sicheres Rate-Limit fehlen. |
| Admin-only Nutzerverwaltung | Teilweise | Mock-UI vorhanden; Server-Nutzer-API fehlt und Render-Gate ist fehlerhaft (P2-4). |
| Board mit zehn Status, DnD und Detail-Statusleiste | Teilweise | UI und Server-Overlay vorhanden; DATEV-Initialmapping/Writeback fehlen, `ua`/`uv` ist per API ungeschützt. |
| Arbeitsvorrat und Filter | Erfüllt | Zentrale Selektoren und planbare Ordertypes sind umgesetzt; Skalierung/Pagination bleibt offen. |
| Nur planbare Arten im Board, laufende/sonstige separat | Erfüllt | `verhaltenFor`/`istPlanbar` und Buchungsansicht sind vorhanden. Serverpflichten für Buchungen fehlen. |
| Planungspool, Monatskalender, Kapazität, DnD | Teilweise | Frontend/Mock vorhanden. Serverpersistenz, Nutzerkapazitäts-API, DATEV-Kapazitäten und Writeback fehlen. |
| Umplanungsanfrage und JA/ESt-Freikontingent | Teilweise | Frontend zentral modelliert/getestet; keine Serveraktion, Persistenz oder DATEV-Kopplung. |
| Controlling | Teilweise | Selektoren/View vorhanden; DATEV-Kosten-/Leistungsdaten fehlen, Servermapping setzt Seiten/Kosten auf 0. |
| Live-Timer | Teilweise | Timer im Auftragsdetail vorhanden; im neuen Zeiterfassungs-Board laut Konzept noch nicht verdrahtet. |
| Manuelle grafische Zeiterfassung | Teilweise | DnD, Tageswahl und Dauerbuchung vorhanden; Tagessoll falsch für Teilzeit, Uhrzeit nicht persistent, Reload verändert Darstellung (P2-1). |
| Eigene Zeiten freigeben/zurückziehen/löschen | Teilweise | Ownership und Statusregeln werden serverseitig geprüft. Freigabe erzeugt keinen DATEV-Outbox-Vorgang. |
| 12-Stunden-Tagesgrenze | Teilweise | Sequenziell korrekt, aber nicht nebenläufigkeitsfest (P1-4). |
| Laufende Buchungen/Mehraufwand | Teilweise | UI, Suche und Felder vorhanden. Verbindliche Serverprüfung, Kostenposition und DATEV-Übertragung fehlen. |
| Schnellbuchung aus Auftrag | Teilweise | Frontenddialog vorhanden. Ziel-/Teilauftragsvalidierung und DATEV-Übertragung fehlen. |
| Review-Notes und Fragen | Erfüllt | Server-Sichtbarkeit und Rollenworkflow sind sauber umgesetzt und getestet. |
| Dateien an Notes/Fragen | Fehlt | Nur lokal im Demo; Servermapping setzt `attachments: []`, keine Dateiablage/API/MIME-Prüfung. |
| Mandantenbesonderheiten | Teilweise | UI und Repositories vorhanden; keine Serveraktion/Route, im Servermodus nur Browserzustand. |
| Checklisteninstanz und „Erledigt“-Gate | Teilweise | Persistenz, Herkunft und Soft-Delete vorhanden; Pflichtvorlage ist umgehbar (P1-1). |
| Checklisten-Vorlagen und Admin-Import | Teilweise | Frontend/Excel-Import vorhanden. Servervorlagen dupliziert/hardcodiert, keine Admin-API, verwundbares `xlsx`. |
| Teilaufträge Monat/Quartal und nächster offener Chip | Teilweise | Lesen und Anzeige verbessert. Echte ID fehlt; Erledigt-Writeback und Ist-Zeit je Teilauftrag fehlen. |
| Auftrags-Anforderung an Backoffice | Teilweise | Frontendworkflow und Repositories vorhanden; keine verdrahteten Aktionen/Routen, E-Mail oder Sync-Rückmeldung. |
| E-Mail-Reminder | Fehlt | Kein Mail-Port, Scheduler oder Reminder-Job. |
| DATEV-Aufträge und Mandanten lesen | Teilweise | HTTP-Adapter, Suborders und Clients vorhanden; Employees, Kapazitäten, Kosten/Leistungen und periodischer Pull fehlen. |
| Status/Plandaten/Verantwortliche/Teilaufträge nach DATEV schreiben | Fehlt | Port und Worker fehlen; Outbox ist nur Repository-Infrastruktur. |
| Freigegebene Zeiten als `expensepostings` übertragen | Fehlt | Adaptermethode vorhanden, aber ungenutzt; echte Ziel-Teilauftrags-ID fehlt. |
| Eigene MS-SQL-Persistenz und Migrationen | Teilweise | Fach-Repositories/Schema vorhanden. Nur ein Teil ist über Aktionen/Routen nutzbar; keine echte DB-Ausführung in diesem Review. |
| Deployable mit statischem Frontend und Hintergrundjobs | Fehlt | Fastify liefert nur API-Routen; kein statisches Frontend, Pull-/Outbox-/Reminder-Worker. |
| KI-Notizprüfung | Außerhalb aktuellem Soll | Im Lastenheft als spätere Version geführt. |

## 6. Test-, Coverage- und Audit-Ergebnisse

Ausgeführt am 17.07.2026:

| Prüfung | Ergebnis |
|---|---|
| Frontend `npm run typecheck` | bestanden |
| Frontend `npm run lint` | bestanden |
| Frontend `npm test` | 4 Dateien, 53 Tests bestanden |
| Frontend `npm run build` | bestanden; Haupt-JS 331,48 kB, XLSX-Chunk 429,03 kB |
| Backend `npm run typecheck` | bestanden |
| Backend `npm run lint` | bestanden |
| Backend `npm test` | 12 Dateien, 129 Tests bestanden; eine `TimeoutNegativeWarning` |
| Backend `npm run build` | bestanden |
| Frontend Coverage | 36,96 % Statements, 38,95 % Lines, 26,81 % Functions |
| Backend Coverage | 62,98 % Statements/Lines; Domain-Aktionen 93,73 %, MSSQL 28,15 % |
| Frontend `npm audit --omit=dev` | fehlgeschlagen: 1 hohes direktes Paket (`xlsx`), 2 Advisories |
| Backend `npm audit --omit=dev` | fehlgeschlagen: 7 hohe betroffene Paketknoten |
| Geheimnissuche | keine echten Schlüssel/Zugangsdaten gefunden; Treffer waren Beispiele und Testwerte |

Wesentliche Testlücken:

- Das neue `ZeiterfassungBoard.tsx` wird durch keine Komponenten-/Unit-Tests erfasst.
- Frontend `api/mapping.ts` und `api/session.ts`: 0 % Coverage.
- `api/write.ts`: praktisch ungetestet; dort liegt das Temp-ID-Race.
- Echter HTTP-/NTLM-Transport und `postExpensePosting` sind nicht live geprüft.
- MSSQL-Transaktionsadapter und produktiver Serverstart haben sehr geringe bzw. 0 % Ausführung.
- E2E-Suiten sind manuell und nicht Teil der CI.
- Keine Nebenläufigkeitstests für Tagessumme und Checklisten-Seeding.

## 7. Positiv festgestellte Security- und Qualitätsmerkmale

Diese Punkte sind solide und sollten bei der Abarbeitung erhalten bleiben:

- Produktion verbietet Memory-Repositories mit Demo-Admin und den bekannten Dev-Cookie-Secret
  (`server/src/config.ts:52-64`, `81-87`).
- Unsichere DATEV-TLS-Prüfung ist in Produktion verboten (`server/src/config.ts:76-79`).
- Passwörter werden mit bcrypt gehasht; unbekannte Nutzer durchlaufen einen Dummy-Vergleich gegen
  Timing-Enumeration.
- Session-IDs besitzen 192 Bit Zufall; Cookies sind signiert, `httpOnly`, `sameSite=lax` und in
  Produktion `secure` (`server/src/auth/sessions.ts:36-40`, `server/src/routes/auth.ts:59-67`).
- Deaktivierte Nutzer werden bei jedem Request erneut geprüft und verlieren sofort Zugriff.
- Implementierte auftragsbezogene Mutationen prüfen zentral die DATEV-Sichtbarkeit.
- Zeit-Ownership und Note-Workflow werden serverseitig erzwungen.
- SQL verwendet gebundene Parameter; kein dynamisches SQL mit Nutzereingaben wurde gefunden.
- Keine Nutzung von `eval`, `new Function`, `innerHTML` oder `dangerouslySetInnerHTML` gefunden.
- Unerwartete Serverfehler geben keine internen Details an Clients weiter.
- Status-Overlay und Statushistorie werden im MSSQL-Modus gemeinsam transaktional gespeichert.

## 8. Empfohlene Abarbeitungsreihenfolge

### Paket A – Fachliche Integrität und Security-Gate

1. Checklisten-Bypass serverseitig schließen.
2. Pflichtnotiz/Aufwandsart/Teilauftrag verbindlich validieren.
3. Tagesgrenze transaktional machen.
4. Abhängigkeiten aktualisieren/ersetzen und Audit-CI-Gate ergänzen.
5. `ua`/`uv` serverseitig einschränken.
6. Proxy-sicheren Login-Schutz mit begrenztem Speicher implementieren.

**Abschlusskriterium:** Kein direkter API-Aufruf kann einen Zustand erzeugen, den die Fachregeln
im Frontend verbieten; alle beschriebenen Negativ- und Nebenläufigkeitstests sind grün.

### Paket B – DATEV End-to-End

1. Echte Teilauftrags-ID durch alle Modelle führen.
2. Status-/Completion-Mapping fachlich festlegen.
3. Order-/Suborder-Read-Modify-Write ergänzen.
4. Outbox atomar an alle relevanten Aktionen koppeln.
5. Worker mit Retry, Idempotenz, Fehlerstatus und Monitoring implementieren.
6. Live-Roundtrips mit Testauftrag dokumentieren.

**Abschlusskriterium:** Eine UI-Aktion ist nach Reload und Prozessneustart vorhanden und im
DATEV-Echtsystem nachvollziehbar; Retry erzeugt keine Dubletten.

### Paket C – Restliches Lastenheft im Servermodus

1. Nutzer-/Admin-API inklusive Rechte, Reset/Einladung und Nutzerprofil/Tagessoll.
2. Planung, Umplanung, Verantwortliche und Kapazität.
3. Besonderheiten, Anforderungen und serverseitige Checklisten-Vorlagen.
4. Attachments mit Größen-, Typ-, Malware- und Ablagekonzept.
5. Reminder-/Mailjob und Controlling-Datenquellen.
6. Zeiterfassungs-Board mit persistenter/fachlich ehrlicher Zeitlage.

**Abschlusskriterium:** Keine fachliche Servermodus-Aktion lebt ausschließlich in `localStorage`.

### Paket D – Betrieb und Abnahme

1. Board-Aggregat bündeln/paginieren; DATEV-Timeouts und Healthcheck härten.
2. Security-Header, Bodylimits und Konfigurationsvalidierung.
3. Statische Frontendauslieferung und vertrauenswürdig konfigurierter Reverse Proxy.
4. MSSQL-Integrationstests und automatisierte E2E-Suiten.
5. Audit, Backup/Restore, Monitoring, Runbook und Rollback-Test.
6. Lastenheft-Widersprüche bereinigen und formale Abnahmematrix freigeben.

## 9. Schlussbewertung

- **Demo/Weiterentwicklung:** freigabefähig.
- **Interner UI-Test mit Mock-Daten:** freigabefähig, bekannte Lücken klar kennzeichnen.
- **Pilot mit Echtdaten:** nicht freigabefähig, solange P1-1 bis P1-5 offen sind.
- **Produktivbetrieb:** nicht freigabefähig, solange DATEV End-to-End, restliche
  Serverpersistenz, Dependency-Security und Betriebsnachweise fehlen.

Die grüne Testlage ist ein gutes Fundament, aber kein Gegenbeweis zu den Befunden: Die kritischsten
Lücken liegen überwiegend in nicht implementierten End-to-End-Pfaden, direkten API-Umgehungen,
Nebenläufigkeit und Außenintegrationen – genau den Bereichen, die die aktuelle Testsuite nur
teilweise oder gar nicht ausführt.

