# Architektur-Entscheidungen (M2-Backend)

> **Was ist das?** Eine Sammlung bewusster, begründeter Architektur-Entscheidungen für das Backend
> (Meilenstein 2), bevor der erste Backend-Code entsteht. Jede Entscheidung im selben Muster:
> **Entscheidung → Warum → Konsequenz → (verworfene Alternative)**.
>
> **Wie lesen?**
> - **Du (Auftraggeber):** Lies die *Leitprinzipien* und die **Klartext-Zeile** am Anfang jeder
>   Entscheidung — das reicht, um zu wissen, *was* wir tun und *warum*. Die Technik darunter kannst
>   du überspringen.
> - **Entwickler / Dienstleister:** Das ganze Dokument ist die fachlich prüfbare Begründung. Es ist
>   ein „ADR"-Stil (Architecture Decision Records) — Entscheidungen, nicht Code.
>
> **Status:** Entwurf, gültig ab 27.06.2026. Baut auf `docs/architektur.md` (Zielbild/Deployment),
> `docs/m2-plan.md` (Fahrplan) und `docs/datev-connect-handoff.md` (verifizierte DATEV-Mechanik) auf.

---

## Leitprinzipien (der rote Faden)

1. **So einfach wie möglich — aber die wenigen „Nähte", die zählen, sauber.** Kein Over-Engineering.
   Wir bauen *einen* überschaubaren Dienst, nicht ein Geflecht aus Microservices. Aber an drei
   Stellen ziehen wir bewusst klare Trennlinien: **DATEV-Anbindung**, **Fachregeln**, **Datenbank**.
   Diese drei wechseln am ehesten oder müssen testbar sein.
2. **Die Regeln sind der Kern — und sie gehören auf den Server.** Wer was darf (Freigaben,
   Umplanung, Status), wird **serverseitig** erzwungen, nicht im Browser. Der Browser macht es nur
   *bequem*; verlassen kann man sich nur auf den Server.
3. **DATEV ist führend, aber gekapselt.** DATEV liefert die Aufträge; wir spiegeln und schreiben
   zurück. Der gesamte DATEV-Kontakt läuft durch **ein** Modul. Ändert DATEV etwas, fassen wir eine
   Stelle an — nicht die ganze App.
4. **Alles, was wir bauen, muss ohne DATEV und ohne echte Datenbank testbar sein.** So wie das
   Frontend heute mit Mock-Daten läuft.
5. **Wartbar für ein kleines Team mit KI-Unterstützung.** Klare Struktur, gängige Werkzeuge, wenig
   „Magie". Lieber langweilig und verständlich als clever und fragil.

---

## ADR-01 — Aufbau in drei Schichten (pragmatische „Ports & Adapters")

**Klartext:** Wir teilen das Backend in drei klar getrennte Ebenen, damit sich Fachlogik, Außenwelt
(DATEV/DB/Mail) und Web-Schnittstelle nicht vermischen.

**Entscheidung:**
```
  [API-Schicht]      HTTP/REST: nimmt Anfragen der Oberfläche an, prüft Eingaben, ruft Fachlogik
        │
  [Domain-Schicht]   die Fachregeln: Status-Übergänge, Freigaben, Umplanungs-Kontingent, Zeit-Logik
        │            (kennt KEINE Datenbank, KEIN DATEV — nur reine Regeln)
        │
  [Infrastruktur]    austauschbare „Adapter": DATEV-Adapter, Datenbank-Repositories, Mail-Versand
```
Die Domain-Schicht definiert **Schnittstellen** („Ports", z. B. „so sieht ein Auftrags-Speicher
aus"), die Infrastruktur **erfüllt** sie („Adapter"). Abhängigkeiten zeigen immer **nach innen**:
Infrastruktur kennt die Domain, nicht umgekehrt.

**Warum:** Die Fachregeln sind das Wertvolle und Langlebige. Hält man sie frei von Datenbank- und
DATEV-Details, kann man sie isoliert testen und verstehen, und man kann DB oder DATEV-API austauschen,
ohne die Regeln anzufassen.

**Konsequenz:** Etwas mehr Struktur am Anfang (Schnittstellen definieren). Zahlt sich ab dem ersten
Umbau aus.

**Verworfen:** „Alles in den Web-Endpunkten" (schnell, aber Regeln verkleben mit SQL und DATEV →
unwartbar) und „volle Hexagonal-/Clean-Architecture mit vielen Schichten" (zu schwergewichtig für
eine interne App).

---

## ADR-02 — Fachregeln serverseitig erzwingen; Frontend nur fürs Bedien-Erlebnis

**Klartext:** Was ein Nutzer darf, entscheidet der Server. Der Browser zeigt Knöpfe passend an, aber
die echte Kontrolle liegt hinten.

**Entscheidung:** Alle sicherheits-/fachrelevanten Regeln (Rollen, Freigaben, Umplanungs-Kontingent,
zulässige Status-Übergänge, Zeit-Freigabe) werden in der **Domain-Schicht** geprüft und bei jeder
schreibenden API-Anfrage durchgesetzt. Das Frontend behält dieselben Regeln **nur** für Anzeige/UX
(Knopf ausgrauen). Die heute im Zustand-Store (`src/lib/tokens.ts`, `src/state/selectors.ts`)
liegenden Policies werden ins Backend übernommen.

**Warum:** Ein Browser ist manipulierbar. Verlässlich ist nur die serverseitige Prüfung. Das ist
auch der Grund, warum ein Entwickler „Architektur" betont: Regeln am falschen Ort sind ein
Sicherheits- und Wartungsrisiko.

**Konsequenz:** Regeln existieren an zwei Orten (Server = verbindlich, Frontend = Komfort). Um sie
synchron zu halten, **teilen** wir die reinen Regel-Typen/-Konstanten über ein gemeinsames Paket
(siehe ADR-12).

---

## ADR-03 — Sprache & Web-Framework: Node.js (LTS) + TypeScript + Fastify

**Klartext:** Das Backend läuft mit derselben Programmiersprache wie die Oberfläche (TypeScript) auf
Node.js. Als schlankes Web-Gerüst nehmen wir Fastify.

**Entscheidung:** Node.js (aktuelle LTS) + TypeScript; Web-Framework **Fastify**.

**Warum:** Dieselbe Sprache vorne wie hinten → ein Werkzeugkasten, geteilte Typen, weniger
Kontextwechsel (wichtig für ein kleines Team). Fastify ist leichtgewichtig, schnell und hat
**eingebaute Schema-Validierung** für Anfragen — das passt zu „Eingaben am Rand prüfen" (ADR-01).

**Konsequenz:** Node.js muss auf dem Server vorhanden sein (eine der wenigen Installationen, siehe
Deployment). TypeScript wird vor dem Deployment zu fertigem JavaScript „gebaut".

**Verworfen:** Express (älter, weniger eingebaute Validierung), sowie ein Sprachwechsel (z. B. C#/.NET)
— technisch möglich, würde aber den geteilten Code mit dem Frontend aufgeben.

---

## ADR-04 — Datenbank: bestehendes Microsoft SQL Server, eigene Datenbank, Zugriff über `mssql`

**Klartext:** Wir nutzen das **schon vorhandene MS-SQL** auf dem Server — in einer **eigenen, neuen
Datenbank** nur für diese App. Damit entfällt eine Zusatz-Installation.

**Entscheidung:** Persistenz auf der bestehenden **Microsoft-SQL-Server-Instanz**, in einer
**dedizierten Datenbank** (z. B. `Zeiterfassung`) mit **eigenem DB-Benutzer**, der **nur** darauf
Rechte hat. Datenzugriff über das **`mssql`-Paket** (Microsofts Node-Treiber `tedious` — reines
JavaScript). Das Schema liegt versioniert als **idempotentes SQL-Skript** im Repo
(`server/db/schema.sql`, angewendet über `npm run db:setup`).

**Warum:** MS SQL ist bereits in Betrieb (Backup/Monitoring durch den ASP-Dienstleister vorhanden) →
**eine Genehmigungs-/Installationshürde weniger** als ein zusätzliches PostgreSQL. Eine **separate
Datenbank** trennt unsere Daten sauber von Fremddaten. `mssql`/`tedious` besteht aus reinem
JavaScript — **keine nativen Binärdateien, kein Kompilieren** (gleiche Begründung wie bcryptjs in
ADR-07: auf dem abgeriegelten ASP-Server dürfen wir nichts nachinstallieren).

**Konsequenz:** Der DB-Zugriff wird von Anfang an auf MS SQL ausgerichtet (Verbindungsdaten kommen
aus der Umgebung, nie ins Repo). Schema-Änderungen laufen als weitere idempotente Blöcke in
`schema.sql` (jeder Block prüft selbst, ob er nötig ist). Falls MS SQL später doch nicht gewünscht
ist, ist nur die Infrastruktur-Schicht betroffen (ADR-01), nicht die Fachlogik.

**Verworfen:** Eigenes PostgreSQL installieren (zusätzliche Komponente, mehr Abstimmung mit DATEV/ASP);
Daten in eine **bestehende** Fremd-Datenbank schreiben (Vermischung — abgelehnt).

> **Änderung 02.07.2026 — Prisma → `mssql`:** Ursprünglich war **Prisma** vorgesehen (deklaratives
> Schema + Migrationen). Prisma lädt jedoch bei der Installation plattformspezifische
> **Engine-Binärdateien** nach — das scheiterte wiederholt in der Entwicklungs-Umgebung und wäre
> auch auf dem abgeriegelten ASP-Server ein Betriebsrisiko. `mssql`/`tedious` ist reines JavaScript
> und Microsofts empfohlener Node-Treiber. Das frühere `prisma/schema.prisma` bleibt als
> Design-Referenz erhalten; maßgeblich ist jetzt `server/db/schema.sql`.

---

## ADR-05 — DATEV-Anbindung als eigenes, austauschbares Adapter-Modul

**Klartext:** Der gesamte Kontakt mit DATEV steckt in **einem** Modul mit klaren Funktionen. Der Rest
der App weiß nicht, dass dahinter DATEV steht.

**Entscheidung:** Ein **DATEV-Adapter** hinter einer Schnittstelle mit klaren Operationen
(`getOrders`, `getOrder`, `updateOrder`, `updateSuborder`, `getOrdertypes`, `getEmployees`,
`postExpensePosting`, Health-Check). Read-Modify-Write überall (DATEV-PUT überschreibt vollständig).
Die verifizierte Mechanik steht in `docs/datev-connect-handoff.md`.

**Warum:** DATEV ist die größte Unbekannte und das, was sich am ehesten ändert (API-Version,
Cloud-Migration). Eine einzige gekapselte Stelle macht die App robust und — entscheidend —
**testbar**: Für Tests setzen wir einen „Schein-Adapter" ein, genau wie heute der Mock im Frontend.

**Konsequenz:** Eine klar definierte Schnittstelle, die Sandbox/Live/Mock austauschbar macht.

---

## ADR-06 — Synchronisation: Pull-Spiegel + „Outbox" fürs Zurückschreiben

**Klartext:** Wir holen DATEV-Daten regelmäßig ab und merken uns ausstehende Rückschreibungen in
einer Liste, die wir sicher und ohne Dubletten abarbeiten.

**Entscheidung:**
- **Lesen (Pull):** Ein periodischer Job spiegelt Aufträge/Teilaufträge/Auftragsarten/Mitarbeiter in
  unsere DB (als Cache/Overlay). **DATEV ist führend** — in DATEV gelöschte Aufträge werden bei uns
  **archiviert**, nicht hart gelöscht. DATEV-**Stammdaten duplizieren wir nicht**; wir speichern nur
  unsere Zusatzdaten + einen Cache zum schnellen Anzeigen.
- **Zurückschreiben (Push):** Jede Rückschreibung (Status, Plandaten, freigegebene Zeit) wird als
  Eintrag in einer **Outbox**-Tabelle vermerkt und von einem Job abgearbeitet. Jeder Eintrag trägt
  einen **Idempotenz-Schlüssel** und einen Status (`offen → übertragen`). Da der DATEV-Buchungs-POST
  **nicht idempotent** ist (zweimal senden = zwei Buchungen, verifiziert), verhindert das **Dubletten**.

**Warum:** Netz/Dienst können kurz weg sein; ein Job mit Outbox ist robust (nachholbar) und
nachvollziehbar. Der Dubletten-Schutz ist bei Buchungen Pflicht (kein DELETE in der API).

**Konsequenz:** Etwas mehr Buchhaltung (Outbox-Tabelle, Status, Wiederholung), dafür verlässliche,
wiederholbare Synchronisation.

---

## ADR-07 — Authentifizierung: eigener Login mit serverseitiger Session (httpOnly-Cookie)

**Klartext:** Eigener Login mit Benutzer/Passwort; nach dem Login hält ein sicheres Browser-Cookie
die Anmeldung. Kein Microsoft-/DATEV-Login nötig.

**Entscheidung:** Eigene Benutzerverwaltung; Passwörter als **bcrypt-Hash über eine reine-JS-
Bibliothek (`bcryptjs`)** (nie im Klartext); Anmeldung über **serverseitige Session** mit
**httpOnly-, Secure-Cookie**. Rollen `mitarbeiter | partner` + Admin-Flag. Jede schreibende Anfrage
wird serverseitig autorisiert (ADR-02).

**Warum:** Für eine interne App auf **einem** Server sind Server-Sessions einfacher und sicherer als
selbstverwaltete Tokens (kein Token-Diebstahl im Browser-Speicher, einfacher Logout/Invalidieren).
**Passwort-Hash bewusst in reinem JavaScript** (`bcryptjs`), nicht `argon2`: argon2 erfordert eine
**native Kompilierung** (Build-Werkzeuge auf dem Zielserver) — auf dem **gesperrten ASP-Server**
ohne Installationsrechte unpraktikabel. bcrypt ist ein etablierter, sicherer Hash; reine-JS-Variante
läuft überall ohne Build-Schritt.

**Geändert (29.06.2026):** ursprünglich war argon2 vorgesehen; beim Backend-Start auf `bcryptjs`
umgestellt (ASP-Build-Beschränkung, s. o.). Falls auf dem Zielserver doch native Builds möglich sind,
ist ein Wechsel auf argon2 später ohne Architekturänderung möglich (eine Stelle: `auth/passwords.ts`).

**Konsequenz:** Sessions liegen serverseitig (in der DB oder im Speicher). Die App läuft über
**HTTPS** (Cookie-Pflicht), in Produktion über einen schlanken Reverse-Proxy.

**Verworfen:** JWT im Browser-Speicher (mehr Fallstricke bei Logout/Diebstahl); Microsoft-365-SSO
(vom Auftraggeber ausgeschlossen); argon2 (native Kompilierung, s. o.).

---

## ADR-08 — Ein einziges Deployable (Monolith), kein Microservice-Geflecht

**Klartext:** Die ganze App ist **ein** Programm, das als **ein** Dienst auf dem Server läuft — es
liefert die Oberfläche aus, beantwortet Anfragen und erledigt die Hintergrund-Jobs.

**Entscheidung:** Ein Node.js-Prozess enthält: REST-API, **Auslieferung der fertigen Oberfläche**
(statische Dateien) und die **Hintergrund-Jobs** (Sync, Reminder, Outbox). Lauscht auf einem lokalen
Port, läuft als **Windows-Dienst**. Intern bleibt es aber sauber in die drei Schichten (ADR-01)
getrennt.

**Warum:** Für die Größe und das Team ist ein **Monolith mit guter innerer Struktur** das
wartbarste. Mehrere Dienste/Container brächten Komplexität (Netz, Deployment, Überwachung), die wir
nicht brauchen.

**Konsequenz:** Einfaches Deployment (ein Dienst, ein Update-Paket). Falls die Jobs später viel Last
erzeugen, lassen sie sich dank ADR-01/05 leicht in einen eigenen Prozess herauslösen.

**Verworfen:** Microservices / getrennte Frontend+Backend-Server (unnötige Komplexität hier).

---

## ADR-09 — Konfiguration & Geheimnisse außerhalb des Codes

**Klartext:** Passwörter, Zugangsdaten und Server-Adressen stehen **nie** im Code/Repo, sondern in
einer geschützten Konfiguration auf dem Server.

**Entscheidung:** Alle veränderlichen/sensiblen Werte (DB-Verbindung, DATEV-Zugang, Mail-Server,
Session-Schlüssel) kommen aus **Umgebungsvariablen / einer Konfigurationsdatei auf dem Server**, die
**nicht** im Repository liegt. Eine **`.env.example`** im Repo dokumentiert nur die *Namen* der Werte.

**Warum:** Geheimnisse im Code sind das häufigste Sicherheitsleck. Trennung erlaubt zudem
unterschiedliche Werte für Test/Live ohne Codeänderung.

**Konsequenz:** Beim Aufsetzen muss die Konfiguration einmal hinterlegt werden (Teil der
Deployment-Anleitung).

---

## ADR-10 — Testbarkeit von Anfang an (Schein-Adapter statt echter Außenwelt)

**Klartext:** Wir können die App testen, ohne echtes DATEV und ohne echte Datenbank — durch
„Platzhalter", die sich wie das Echte verhalten.

**Entscheidung:** Domain-Schicht enthält **reine** Funktionen (leicht als Unit-Test prüfbar). DATEV
und DB stehen hinter Schnittstellen (ADR-01/05) und werden in Tests durch **In-Memory-/Schein-
Implementierungen** ersetzt. Zusätzlich einige **Integrationstests** gegen die DATEV-Sandbox bzw.
eine Test-Datenbank.

**Warum:** Tests, die echtes DATEV brauchen, sind langsam, fragil und brauchen Zugang. Die Trennung
macht den Großteil der Logik schnell und zuverlässig testbar — die bestehenden 32 Frontend-Tests
sind das Muster.

**Konsequenz:** Schnittstellen müssen sauber definiert sein (das tun ADR-01/05 ohnehin).

---

## ADR-11 — Zentrale Fehlerbehandlung, Protokollierung & Änderungs-Historie

**Klartext:** Fehler werden an einer Stelle einheitlich behandelt; wichtige Aktionen werden
mitprotokolliert, damit man später nachvollziehen kann, wer wann was geändert hat.

**Entscheidung:** Ein zentraler Fehler-Handler in der API-Schicht (einheitliche Antworten, keine
internen Details nach außen). **Strukturiertes Logging** (maschinenlesbar). Eine **Status-/Änderungs-
Historie** in der DB für fachlich relevante Vorgänge (Statuswechsel, Freigaben, Buchungen: wer/wann/
von→nach).

**Warum:** In einer Kanzlei-App ist Nachvollziehbarkeit wichtig (Freigaben, Zeiten). Zentrale
Fehlerbehandlung verhindert, dass interne Details oder uneinheitliche Meldungen nach außen gelangen.

**Konsequenz:** Eine `status_history`-Tabelle und ein Logging-Setup gehören ins Grundgerüst.

---

## ADR-12 — Projektstruktur: ein Repository mit drei Bereichen (`web`, `server`, `shared`)

**Klartext:** Oberfläche, Backend und die gemeinsam genutzten Teile liegen in **einem** Projekt,
aber in getrennten Ordnern.

**Entscheidung:**
```
/web      die bestehende Oberfläche (React) — heute der gesamte Code
/server   das neue Backend (API, Domain, Infrastruktur/Adapter)
/shared   gemeinsam genutzte Typen & reine Regel-Definitionen (z. B. Status-Liste, Policies)
```
Das `shared`-Paket löst das „Regeln an zwei Orten"-Thema aus ADR-02: die **eine Wahrheit** der
Typen/Konstanten liegt zentral, beide Seiten nutzen sie.

**Warum:** Ein Repository ist für ein kleines Team am einfachsten (ein Ort, eine Versionsgeschichte,
ein CI). Gemeinsame Typen verhindern, dass Frontend und Backend „auseinanderlaufen".

**Konsequenz:** Heutiger `src/`-Code wandert perspektivisch nach `/web`; das ist eine reine
Verschiebung (kein Logikbruch). Schritt wird beim Backend-Start gemacht, nicht vorher.

**Verworfen:** Zwei getrennte Repositories (Typen müssten dann mühsam synchron gehalten werden).

---

## ADR-13 — Entwicklungsumgebung lokal (Kanzlei-PC), Produktion später im ASP

**Klartext:** Entwickelt und getestet wird **auf dem eigenen Rechner** — dort haben wir alle Rechte
(SQL Server Express, Node.js) und **echten DATEV-Zugriff** über die VPN-Verbindung. Der spätere
Produktivbetrieb liegt im ASP.

**Entscheidung (02.07.2026):** Lokale Entwicklungsumgebung mit **SQL Server Express** (gleiche
Technik wie das ASP-MS-SQL) und DATEVconnect-Zugriff per **NTLM** über VPN (live verifiziert,
Handoff §12). Alle Umgebungs-Unterschiede stecken **ausschließlich in der Konfiguration**
(`.env`: DB-Host, DATEV-URL/Anmeldeweg) — nie im Code. Einrichtung + Umzugs-Checkliste:
`docs/entwicklungsumgebung.md`.

**Warum:** Kein Warten auf den ASP-Anbieter; schnelle Iteration mit echten DATEV-Daten; die
Produktions-Technik (MS SQL, Node, DATEVconnect) wird 1:1 lokal gespiegelt, nur kleiner.

**Konsequenz:** Der DATEV-Adapter beherrscht **beide** Anmeldewege (NTLM für die Entwicklung,
Basic Auth für den technischen Benutzer in Produktion — umschaltbar per `DATEV_AUTH`).
`DATEV_TLS_INSECURE` (IP-Zugriff in Entwicklung) ist in Produktion **verboten** (Fail-Fast).

**Verworfen:** Entwicklung nur gegen Mocks bis zur ASP-Bereitstellung (verschenkt den verifizierten
externen Zugriff); Entwicklung direkt auf dem ASP-Server (keine Rechte, keine Werkzeuge).

---

## Was wir bewusst NICHT tun (damit es einfach bleibt)

- **Keine Microservices, keine Container-Orchestrierung.** Ein Dienst, ein Server (ADR-08).
- **DATEV-Stammdaten nicht duplizieren.** Nur Zusatzdaten + Cache; DATEV bleibt führend (ADR-06).
- **Keine vorzeitige Abstraktion.** Schnittstellen nur dort, wo echter Austausch/Test ansteht
  (DATEV, DB, Mail) — nicht „auf Vorrat" überall.
- **Keine Geheimnisse im Code** (ADR-09). **Keine Fachregeln nur im Browser** (ADR-02).
- **Kein Sprach-/Stack-Wildwuchs.** TypeScript vorne wie hinten (ADR-03).

---

## Auf einen Blick (Klartext-Zusammenfassung)

| Thema | Entscheidung |
|---|---|
| Aufbau | 3 Schichten: Web-API → Fachregeln → Adapter (DATEV/DB/Mail) |
| Wo gelten die Regeln? | Verbindlich auf dem Server; Browser nur fürs Bedien-Erlebnis |
| Sprache/Technik | Node.js + TypeScript, Web-Gerüst Fastify |
| Datenbank | **bestehendes MS SQL**, eigene Datenbank, Zugriff über `mssql` (reines JS) |
| Entwicklung | lokal (SQL Express + DATEV per VPN/NTLM); Umzug ins ASP = nur Konfiguration |
| DATEV | ein gekapseltes Adapter-Modul, austauschbar & testbar |
| Synchronisation | regelmäßiges Abholen + Outbox fürs Zurückschreiben (dublettensicher) |
| Login | eigener Login, sichere Server-Session (Cookie), Passwort-Hash |
| Auslieferung | **ein** Dienst auf **einem** Server (Oberfläche + API + Jobs) |
| Geheimnisse | nie im Code — Konfiguration auf dem Server |
| Testbarkeit | alles ohne echtes DATEV/DB testbar (Platzhalter) |
| Struktur | ein Repo, Ordner `web` / `server` / `shared` |

> Diese Entscheidungen sind die Grundlage für Phase 2 (Backend-Gerüst) im `docs/m2-plan.md`.
> Änderungen hier als neue/aktualisierte ADR festhalten, nicht still überschreiben.
