# Kritischer Code-, Security- und Reifegrad-Review vom 20.07.2026

## 1. Kurzfazit

Die Codebasis ist als Entwicklungsgrundlage brauchbar: Die zentralen IDOR-Gates, Rollenregeln,
parametrisierten SQL-Zugriffe, Produktions-Fail-Fasts und die vorhandenen Tests sind solide.
Für eine fachliche oder produktive Abnahme ist der Stand jedoch noch nicht freigabefähig.

Mehrere bereits bekannte P1-Befunde sind weiterhin reproduzierbar:

1. Die Pflichtcheckliste und damit das „Erledigt“-Gate können mit clientseitig gewählten
   Vorlagenpunkten umgangen werden.
2. Die 12-Stunden-Tagesgrenze ist bei parallelen Buchungen nicht atomar.
3. Teilauftrags-IDs sowie die Pflichtnotiz-/Aufwandsart-Regeln werden serverseitig nicht
   vollständig validiert.
4. Der DATEV-Writeback einschließlich Outbox-Job ist noch nicht umgesetzt.
5. In produktiven und entwicklungsnahen Abhängigkeiten bestehen bekannte High-Severity-
   Schwachstellen.

Ein weiterer optischer Test ist sinnvoll, wenn er ausdrücklich als Demo-/Design-Test verstanden
wird. Vor einer fachlichen Abnahme sollten mindestens die P1-Pakete aus Abschnitt 8 erledigt sein.

## 2. Prüfungsumfang und Stand

- Lokaler Branch: `claude/magical-gauss-3h604n`
- Geprüfter HEAD: `82631d61eab962834de8af23f3dcf89a2a31645c`
- GitHub-Repository: `OliverBurchardt-de/Zeiterfassung` (öffentlich)
- Für den geprüften Commit war kein Pull Request und kein GitHub-Actions-Status vorhanden.
- Geprüft wurden Frontend, Fastify-Backend, Domain-Aktionen, Memory-/MSSQL-Repositories,
  DATEV-Adapter, Authentifizierung, CI, Roadmap und bestehende Review-Dokumente.
- Der Review hat keine fachlichen Dateien verändert. Erzeugte Coverage-Verzeichnisse wurden
  nach der Auswertung wieder entfernt.

Der Arbeitsbaum war bereits vor dem Review unsauber: `package-lock.json` war geändert; außerdem
lagen unter anderem eine vollständige ungetrackte Projektkopie in `Zeiterfassung/` sowie mehrere
ungetrackte Review-Dokumente vor. Diese Bestandsänderungen wurden nicht angefasst.

## 3. Priorisierte Befunde

### P1-1 – Clientseitig kontrollierte Pflichtcheckliste umgeht das „Erledigt“-Gate

**Fundstellen**

- `server/src/routes/checklist.ts:12-20`
- `server/src/domain/actions/checklist.ts:25-39,55-64`
- `server/src/domain/actions/status.ts:44-52`

`POST /api/orders/:orderId/checklist/ensure` akzeptiert eine frei wählbare Label-Liste von jedem
Nutzer, der den Auftrag sehen darf. `seedChecklist` speichert diese Labels als Herkunft
`vorlage`. Sobald mindestens ein Punkt existiert, seedet die Status-Aktion die serverseitige
Default-Vorlage nicht mehr.

Damit kann ein Bearbeiter beispielsweise nur `['beliebig']` anlegen, diesen Punkt abhaken und den
Auftrag anschließend erfolgreich auf `er` setzen. Gleichzeitig wird der manipulierte Punkt als
Pflichtpunkt unlöschbar.

**Reproduktion:** erfolgreich gegen die In-Memory-Domain-Aktionen; resultierende Checkliste
`['beliebig']`, resultierender Board-Status `er`.

**Empfehlung:** Die öffentliche Ensure-API darf keine Vorlagenlabels entgegennehmen. Der Server
muss die gültige, versionierte Vorlage anhand des Ordertypes laden. Instanziierung muss
transaktional und je Auftrag eindeutig sein. Admin-gepflegte Vorlagen benötigen eine eigene,
serverseitig autorisierte Verwaltung.

### P1-2 – Die 12-Stunden-Tagesgrenze hat eine Race Condition

**Fundstellen**

- `server/src/domain/actions/time.ts:78-121`
- `server/src/infra/mssql/times.ts:83-91`

Die Aktion liest zunächst `sumByUserAndDate` und führt anschließend einen separaten Insert aus.
Zwei parallele Requests mit verschiedenen Idempotenzschlüsseln können dieselbe alte Summe sehen
und beide erfolgreich schreiben.

**Reproduktion:** Zwei parallele Buchungen à 7 Stunden wurden beide akzeptiert; die gespeicherte
Tagessumme betrug danach 14 Stunden.

**Empfehlung:** Summenprüfung und Insert in eine gemeinsame MSSQL-Transaktion verschieben, zum
Beispiel mit `SERIALIZABLE`, gezieltem Benutzer-/Datums-Lock oder einer gleichwertigen
repositoryseitigen Commit-Operation. Ein echter MSSQL-Nebenläufigkeitstest muss den Fall absichern.

### P1-3 – Teilauftrags- und laufende Buchungsregeln sind serverseitig unvollständig

**Fundstellen**

- `server/src/domain/actions/time.ts:62-108`
- `server/src/domain/types.ts:83-93,107-125`
- `server/src/datev/httpAdapter.ts:247-260`
- `src/features/laufende/LaufendeView.tsx:122-137`

`bookTime` prüft lediglich den Hauptauftrag. Eine übergebene `suborderId` wird weder auf Existenz
noch auf Zugehörigkeit zum Auftrag geprüft. Eine Buchung mit `suborderId: 'does-not-exist'` wurde
im Review erfolgreich gespeichert.

Das Modell trägt an `SuborderView` nur eine Nummer, obwohl der spätere DATEV-POST eine stabile
Teilauftrags-ID im URL-Pfad benötigt. Zusätzlich werden Pflichtnotiz und Pflicht-Aufwandsart für
laufende Auftragsarten nur in der UI, nicht in der Domain-Aktion erzwungen.

**Empfehlung:** Echte DATEV-Suborder-ID modellieren und vor jeder Buchung gegen den geladenen
Auftrag prüfen. Ordertype-Regeln serverseitig spiegeln; Notiz, Aufwandsart und später
`costPosition` verbindlich validieren.

### P1-4 – DATEV-Writeback und Outbox-Verarbeitung fehlen

**Fundstellen**

- `server/src/domain/actions/time.ts:125-142`
- `server/src/domain/actions/status.ts:55-68`
- `server/src/infra/mssql/transaktion.ts:15-22`
- `docs/m2-plan.md:179-181,213-223`

Freigeben einer Zeit setzt ausschließlich den lokalen DB-Status. Statuswechsel übergeben keinen
Outbox-Eintrag an die bereits vorbereitete Transaktion. Ein Sync-Job, Retry/Dead-Letter-Verhalten,
DATEV-Konfliktbehandlung und das Setzen von `uebertragen` existieren noch nicht.

Die UI-Texte „wird übertragen“ beziehungsweise „nach Freigabe übertragen“ sind deshalb im
Servermodus noch nicht durch eine End-to-End-Funktion gedeckt.

**Empfehlung:** Vor weiteren produktionsnahen Tests zuerst ein vertikales End-to-End-Inkrement
fertigstellen: Freigabe/Statusänderung → atomarer Outbox-Eintrag → DATEV-Schreibvorgang →
Erfolg/Retry/Fehlerstatus → sichtbare Rückmeldung im Frontend.

### P1-5 – Bekannte Dependency-Schwachstellen

Der aktuelle `npm audit --omit=dev` meldet:

- Frontend: ein High-Severity-Knoten (`xlsx`). Relevant, weil die App hochgeladene Excel-/CSV-
  Dateien mit SheetJS verarbeitet (`src/features/verwaltung/ChecklistImportModal.tsx:34-41`).
  Gemeldet werden Prototype Pollution (GHSA-4r6h-8v6p-xvw6) und ReDoS
  (GHSA-5pgg-2g8v-p4x9).
- Server: sieben betroffene High-Severity-Abhängigkeitsknoten, insbesondere Fastify/`fast-uri`
  sowie `httpntlm`/`underscore`. Das sind nicht sieben unabhängig ausnutzbare Fehler, aber eine
  ungeklärte produktive Supply-Chain-Baseline.
- Voller Server-Audit einschließlich Dev-Abhängigkeiten: 13 betroffene Knoten, davon zwei
  kritisch. Die kritischen Vitest-Befunde betreffen Entwicklungswerkzeuge, nicht den gebauten
  Produktionsserver.

Vite ist zusätzlich veraltet und wird über `host: true` ins lokale Netz gebunden
(`vite.config.ts:13-20`). Damit sind Dev-Server-Advisories auf einem Kanzlei-PC relevanter als bei
einer reinen localhost-Bindung.

**Empfehlung:** SheetJS ersetzen oder auf eine nachweislich gepatchte Bezugsquelle/Version
migrieren und Importlimits ergänzen. Fastify-5-Migration testen. Für NTLM eine gepflegte
Alternative oder einen isolierten Adapterprozess prüfen. Bis zum Upgrade Vite ausschließlich an
localhost binden und nicht als Produktionsserver verwenden.

### P2-1 – Logout kann nur scheinbar erfolgreich sein

**Fundstelle:** `src/api/session.ts:42-50`

Schlägt der Logout-Request fehl, leert der Client trotzdem seinen lokalen Zustand. Das
`httpOnly`-Cookie und die Serversession bleiben jedoch gültig. Auf einem gemeinsam genutzten
Arbeitsplatz kann die Sitzung wiederhergestellt werden, sobald der Server erneut erreichbar ist.

**Empfehlung:** Fehlgeschlagenen Logout sichtbar als unvollständig behandeln. Eine lokale
Logout-Sperrmarke kann ein automatisches Restore verhindern; zusätzlich sollte der Nutzer zum
Schließen des Browsers aufgefordert werden. Mittelfristig sind persistente, zentral widerrufbare
Sessions und eine „alle Sitzungen beenden“-Funktion sinnvoll.

### P2-2 – Admin-Ansicht ist nicht beim Rendern geschützt

**Fundstellen**

- `src/App.tsx:64-77`
- `src/app/TopBar.tsx:35-44`
- `src/features/verwaltung/VerwaltungView.tsx:13-17`

Nur der Navigationsknopf wird anhand `isAdmin` ausgeblendet. Bleibt der lokale Modulzustand nach
einem Admin-Logout auf `verwaltung`, kann ein anschließend angemeldeter Nicht-Admin die
Verwaltungsansicht weiter gerendert bekommen. `apiLogout` leert außerdem weder die lokale
Nutzerliste noch den Modulzustand.

Aktuell führen die meisten Verwaltungsaktionen nur zu lokalen Änderungen; spätestens mit der
Nutzer-API darf daraus jedoch kein serverseitiger Autorisierungsersatz werden.

**Empfehlung:** Verwaltung in `App` und in der View selbst renderseitig gaten, Modul bei
Rechteverlust zurücksetzen und sensible benutzerbezogene Caches beim Logout leeren. Jede künftige
Admin-API benötigt unabhängig davon ein serverseitiges Admin-Gate.

### P2-3 – DATEV-Status wird ohne Overlay pauschal als Arbeitsvorrat angezeigt

**Fundstelle:** `src/api/mapping.ts:37-40`

`statusOf` berücksichtigt ausschließlich `boardStatus`. Fehlt das Overlay, wird jeder DATEV-
Auftrag als `av` angezeigt, auch wenn DATEV bereits einen fortgeschrittenen Abschlussstatus
liefert. Dadurch können importierte Aufträge fachlich rückwärts erscheinen.

**Empfehlung:** Ein dokumentiertes Roundtrip-Mapping zwischen DATEV-Status und den zehn
Board-Status definieren, serverseitig testen und beim ersten Import anwenden.

### P2-4 – Optimistische Temp-ID- und Reload-Races

**Fundstelle:** `src/api/write.ts:38-160`

Neue Zeiten, Notes, Kommentare und Checklistenpunkte erhalten zunächst Client-IDs. Eine sofortige
Folgeaktion kann diese temporäre ID an den Server senden, bevor die echte ID zurückgeliefert wurde.
Ein Fehler löst anschließend einen vollständigen Board-Reload aus, der andere noch laufende
optimistische Änderungen überschreiben kann.

**Empfehlung:** Abhängige Aktionen bis zur Bestätigung queueen oder deaktivieren. Alternativ vom
Client vergebene IDs serverseitig als echte IDs akzeptieren. Reload/Reconciliation benötigt eine
geordnete Mutationswarteschlange statt unkoordinierter Fire-and-forget-Aufrufe.

### P2-5 – Verfügbarkeits- und Proxy-Härtung fehlen

**Fundstellen**

- `server/src/datev/httpAdapter.ts:127-187`
- `server/src/routes/health.ts:4-7`
- `server/src/app.ts:25-30`
- `server/src/routes/auth.ts:38-54`

DATEV-Aufrufe besitzen keinen Timeout, keine begrenzten Retries und keinen Circuit Breaker. Der
tiefe DATEV-Healthcheck ist anonym erreichbar und kann Upstream-Traffic und Logeinträge erzeugen.

Die Login-IP-Sperre hängt an `req.ip`, Fastify wird aber ohne gezielt eingeschränktes `trustProxy`
gebaut. Hinter dem vorgesehenen Reverse Proxy können deshalb alle Kanzleinutzer als dieselbe IP
erscheinen und durch fünf Fehlversuche gemeinsam gesperrt werden.

**Empfehlung:** Upstream-Timeouts/Abort, Circuit Breaker und Rate Limits ergänzen. Öffentlich nur
einen billigen Liveness-Check anbieten; DATEV-/DB-Readiness intern oder authentifiziert halten.
`trustProxy` ausschließlich für die konkrete Proxy-Adresse konfigurieren und testen.

### P2-6 – Servermodus enthält weiterhin nur scheinbar persistente Kernfunktionen

**Fundstellen**

- `src/state/store.ts:269-332,436-488,576-597`
- `docs/m2-plan.md:179-181`

Planung, Umplanung, Verantwortliche, Teilauftrag-Abschluss, Anforderungen, Besonderheiten,
Nutzerverwaltung, Checklisten-Vorlagen und Attachments sind im Servermodus noch nicht oder nur im
Browser persistiert. Ein späterer Board-Reload kann den Eindruck erfolgreicher fachlicher
Änderungen wieder auflösen.

**Empfehlung:** Unfertige Aktionen im Servermodus sichtbar deaktivieren oder vollständig über
autorisierte APIs anbinden. Keine produktive Fachfunktion ausschließlich in `localStorage`
belassen.

### P2-7 – Öffentliches Repository enthält interne Infrastrukturangabe

Das GitHub-Repository ist öffentlich. In `docs/datev-extern-test.ps1:14,29,32` ist eine interne
10.x-Adresse des DATEV-Ziels versioniert. Echte Passwörter, private Schlüssel oder Tokens wurden
bei der gezielten Suche nicht gefunden; `server/.env` wird korrekt durch
`server/.gitignore` ausgeschlossen.

**Empfehlung:** Interne Adressen durch Platzhalter ersetzen und prüfen, ob die öffentliche
Repository-Sichtbarkeit beabsichtigt ist. Da die Information bereits historisch versioniert ist,
reicht eine Änderung nur im aktuellen Stand bei erhöhtem Schutzbedarf nicht aus.

### P3-1 – Audit-Historie ist fachlich unvollständig

Statuswechsel werden historisiert. Änderungen und Löschungen von Zeiten, Notes, Kommentaren,
Checklisten, Planungen, Besonderheiten und Nutzern besitzen dagegen keine durchgängige
revisionsfähige Historie. Zeit- und Note-Löschungen sind Hard Deletes.

**Empfehlung:** Vor Produktivbetrieb ein Auditmodell mit Actor, Zeitpunkt, Aktion, Objekt und
fachlichem Vorher-/Nachher-Zustand festlegen. Lösch- und Aufbewahrungsregeln mit Datenschutz und
berufsrechtlichen Anforderungen abstimmen.

### P3-2 – Security-Header und Konfigurationsvalidierung sind unvollständig

Es ist keine zentrale Helmet-/Header-Konfiguration vorhanden. Login-Benutzername und Passwort
haben keine Obergrenzen. `PORT`, `SESSION_TTL_MS` und DB-Port werden ohne Bereichs-/NaN-Prüfung
übernommen. `DB_TRUST_CERT` ist standardmäßig aktiv.

**Empfehlung:** CSP, Frame-/MIME-/Referrer-Header zentral setzen, Loginfelder begrenzen und die
gesamte Konfiguration per Schema validieren. Unsichere Zertifikatseinstellungen in Produktion
fail-fast ablehnen oder ausdrücklich dokumentiert begrenzen.

### P3-3 – Board-Aggregat skaliert als N+1-Abfrage

`server/src/domain/actions/board.ts:65-89` lädt pro sichtbarem Auftrag Zeiten, Notes,
Checklisten und pro Note Kommentare einzeln. Mit tausenden DATEV-Aufträgen entsteht eine hohe Zahl
kleiner MSSQL-Abfragen.

**Empfehlung:** Batch-Repositories für sichtbare Order-IDs bereitstellen und Aggregation im Server
über gruppierte Resultsets ausführen. Reale Datenmengen in einen Lasttest aufnehmen.

## 4. Noch offene Produkt- und Betriebslücken

Die meisten Punkte sind in `docs/m2-plan.md` bereits als nächste Etappe oder Produktionsvoraussetzung
angelegt. Für eine belastbare App-Basis fehlen insbesondere:

- Server-APIs für Planung, Umplanung/Freigaben, Verantwortliche, Teilauftrag-Abschluss,
  Anforderungen, Besonderheiten, Nutzer und Checklisten-Vorlagen.
- Vollständiger DATEV-Pull/Push mit Outbox, Retry, Dead Letter, Konfliktbehandlung und sichtbarem
  Übertragungsstatus.
- Sichere Attachments mit Größenlimit, Typenliste, serverseitiger MIME-/Extension-Prüfung,
  Virenscan, Quarantäne, Storage-Key und Berechtigungsprüfung.
- E-Mail-Reminder für fehlende beziehungsweise nicht freigegebene Zeiten und Anforderungen.
- Reale Mitarbeiterkapazitäten einschließlich Feiertagen, Urlaub und Teilzeit.
- Reale Ist-Kosten, Seiten und Teilauftragszeiten für das Controlling; mehrere Werte werden im
  Mapping derzeit mit `0` befüllt.
- Serverseitige Arbeitszeit-/Timeline-Daten. `startMin` bleibt lokal und erlaubt keine Prüfung von
  Überschneidungen, Pausen oder Arbeitszeitverläufen.
- Benutzer-Lifecycle in der App: Anlage, Rollenwechsel, Deaktivierung, Passwortwechsel/-reset,
  Sitzungsübersicht und optional MFA.
- Backup und getestete Wiederherstellung, Deployment/Update/Rollback, Monitoring,
  Fehleralarmierung, Log-Aufbewahrung, Datenschutz sowie Lösch-/Aufbewahrungsfristen.
- Betriebliches Verfahren für DATEV-Ausfälle und endgültig fehlgeschlagene Übertragungen.

## 5. Test-, Coverage- und Audit-Ergebnisse

| Prüfung | Ergebnis |
|---|---:|
| Frontend Typecheck | sauber |
| Frontend ESLint | sauber |
| Frontend Vitest | 53/53 bestanden |
| Server Typecheck | sauber |
| Server ESLint | sauber |
| Server Vitest | 129/129 bestanden |
| Frontend Coverage | 36,96 % Statements; 33,11 % Branches |
| Server Coverage | 62,98 % Statements; 90,54 % Branches |
| Frontend produktiver npm-Audit | 1 High (`xlsx`) |
| Server produktiver npm-Audit | 7 betroffene High-Knoten |

Wesentliche Testlücken:

- `src/api/client.ts`, `mapping.ts`, `session.ts` und `write.ts` liegen bei ungefähr 0–4 %
  Statement-Coverage.
- Die MSSQL-Repositories liegen überwiegend nur bei ungefähr 20–40 %; getestet werden primär
  Mapper und Mock-Verhalten, nicht echte SQL-Transaktionen.
- Die reproduzierten Race Conditions besitzen keine Negativtests.
- E2E-Suiten liegen im Repository, laufen aber nicht in der GitHub-CI.
- Der aktuelle Feature-Branch erhält ohne Pull Request keinen CI-Lauf, weil die Workflow-Trigger
  nur Pull Requests und Pushes auf `main` umfassen.

## 6. Positiv festgestellte Merkmale

- Auftragsbezogene Domain-Aktionen verwenden zentral `requireVisibleOrder`; Fremdzugriffe liefern
  bewusst 404 statt eines Existenz-Orakels.
- Zeit-Ownership, Note-Policy und Produktions-Fail-Fast werden serverseitig durchgesetzt.
- SQL-Zugriffe verwenden gebundene Parameter; dynamische Nutzereingaben werden nicht in SQL-Text
  interpoliert.
- Session-Cookies sind signiert und `httpOnly`; in Produktion werden sie `secure` gesetzt.
- Deaktivierte Nutzer verlieren beim nächsten Request den Zugriff, weil der Nutzer pro Request
  neu geladen wird.
- Login-Timing wird für unbekannte Nutzer durch einen Dummy-Hash angeglichen; Fehlversuche werden
  begrenzt und ohne Passwort protokolliert.
- Unbekannte Statuswerte, ungültige Kalenderdaten, unplausible Dauerwerte und überlange
  Fachdaten werden abgelehnt.
- Es wurden keine produktiven Verwendungen von `eval`, `new Function`, `innerHTML` oder
  `dangerouslySetInnerHTML` gefunden; React escaped Textinhalte standardmäßig.
- DATEV-Zugangsdaten und die lokale MSSQL-Konfiguration liegen in einer ignorierten `.env`.

## 7. Freigabeempfehlung

**Demo-/Design-Test:** möglich, sofern alle Beteiligten wissen, dass mehrere Servermodus-Funktionen
nicht dauerhaft beziehungsweise nicht bis DATEV durchgeschrieben werden.

**Fachliche Abnahme:** noch nicht empfohlen.

**Produktivbetrieb mit Echtdaten:** nicht empfohlen, bis mindestens Checklisten-Gate,
Zeitintegrität, Teilauftragsmodell, Dependency-Härtung und ein vollständiger DATEV-Outbox-Pfad
umgesetzt und mit realer MSSQL-/DATEV-Nähe getestet sind.

## 8. Empfohlene Abarbeitungsreihenfolge

### Paket A – Fachliche Integrität und unmittelbare Security

1. Clientkontrolliertes Checklist-Seeding entfernen und serverseitig versionierte Vorlagen nutzen.
2. 12-Stunden-Grenze transaktional machen.
3. Teilauftrags-ID/Zugehörigkeit sowie Pflichtnotiz/Aufwandsart serverseitig validieren.
4. SheetJS-, Fastify-, Vite- und NTLM-Abhängigkeiten härten beziehungsweise ersetzen.
5. Logout, Admin-Render-Gate, Proxy-IP-Verhalten und tiefe Healthchecks korrigieren.

### Paket B – DATEV End-to-End

1. Outbox beim Freigeben und bei Status-/Planänderungen atomar befüllen.
2. Sync-Job mit Retry, Konfliktbehandlung, Dead Letter und Operator-Sicht umsetzen.
3. Zeitbuchung bis `expensepostings` und Status/Plandaten bis DATEV durchtesten.
4. DATEV-Initialstatus korrekt auf das Board abbilden.

### Paket C – Servermodus vervollständigen

1. Planung/Umplanung, Verantwortliche und Teilaufträge anbinden.
2. Anforderungen, Besonderheiten, Nutzer und Vorlagen anbinden.
3. Attachments sicher implementieren.
4. Optimistische Mutationen queueen und API-Client/Mapping/Session umfassend testen.

### Paket D – Betrieb und Abnahme

1. MSSQL-Integrations-, Nebenläufigkeits- und Lasttests ergänzen.
2. E2E-Suiten in CI aufnehmen und den Feature-Branch über einen PR prüfen lassen.
3. Backup/Restore, Monitoring, Rollback, Datenschutz und Aufbewahrung dokumentieren und testen.
4. Erst danach fachliche Abnahme und Produktivfreigabe durchführen.
