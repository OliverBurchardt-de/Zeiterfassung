# Arbeitsauftrag aus Code-Review vom 12.07.2026

## Zweck

Dieses Dokument ist der umsetzbare Arbeitsauftrag aus dem Code-Review vom 12.07.2026.
Es beschreibt verbindliche fachliche Entscheidungen, konkrete Befunde und prüfbare
Abnahmekriterien. Änderungen sollen möglichst klein bleiben und die vorhandene Architektur
(Domain-Aktionen, Repository-Ports, Memory- und MS-SQL-Implementierungen, zentrale Policies)
weiterverwenden.

## Verbindliche fachliche Entscheidungen

1. **Zeiten löschen:** Nur Zeiteinträge im Status `erfasst` dürfen gelöscht werden.
   `freigegeben` und `uebertragen` sind gegen Löschen gesperrt. Diese Regel gilt verbindlich
   auf dem Server und zusätzlich in der Oberfläche.
2. **Checklisten-Pflichtpunkte:** Punkte aus einer Checklisten-Vorlage sind Pflichtpunkte und
   dürfen niemals aus der Auftrags-Checkliste gelöscht werden.
3. **Selbst angelegte Checklistenpunkte:** Manuell am Auftrag angelegte Punkte dürfen gelöscht
   werden. Die Löschung muss versioniert beziehungsweise revisionssicher nachvollziehbar sein:
   mindestens gelöschter Inhalt, Auftrag, löschender Nutzer und Löschzeitpunkt bleiben erhalten.
   Gelöschte Punkte erscheinen nicht mehr in der aktiven Checkliste.
4. **Betriebsmodell:** Für den aktuellen Produktivbetrieb ist genau eine laufende zentrale
   Anwendungsinstanz vorgesehen. Es ist akzeptabel, dass sich alle Mitarbeiter nach einem
   Update oder Serverneustart erneut anmelden müssen. Der bestehende In-Memory-Session-Store
   darf deshalb vorerst bestehen bleiben. Eine persistente Session-Speicherung ist aktuell
   kein Arbeitsauftrag.

---

## Priorität 1 – Fachliche Integrität

### 1. Löschen freigegebener Zeiten serverseitig verhindern

**Befund:** `server/src/domain/actions/time.ts` sperrt beim Löschen derzeit nur den Status
`uebertragen`. Ein direkter API-Aufruf kann deshalb eine bereits freigegebene Zeit löschen,
obwohl der Frontend-Store dies nicht zulässt.

**Umsetzung:**

- `deleteTime` darf ausschließlich Einträge mit `status === 'erfasst'` löschen.
- Für `freigegeben` und `uebertragen` muss die Domain-Aktion mit einem fachlich passenden
  Konfliktfehler abbrechen.
- Frontend- und Serverregel müssen denselben zulässigen Zustandsübergang abbilden.
- Bestehende Fehlermeldungen sollen verständlich bleiben; keine internen Details ausgeben.

**Abnahmekriterien:**

- Ein eigener Eintrag mit `erfasst` kann gelöscht werden.
- Ein eigener Eintrag mit `freigegeben` kann weder über UI noch API gelöscht werden.
- Ein eigener Eintrag mit `uebertragen` kann weder über UI noch API gelöscht werden.
- Ein fremder Eintrag bleibt unabhängig vom Status gesperrt.
- Domain- und API-Integrationstests decken alle Fälle ab.

### 2. Pflicht- und manuelle Checklistenpunkte unterscheiden

**Befund:** Der Server unterscheidet aktuell nicht zwischen Punkten aus einer Vorlage und
manuell hinzugefügten Punkten. Jeder Punkt kann gelöscht werden. Dadurch kann das
„Erledigt“-Gate umgangen werden, indem ein offener Pflichtpunkt entfernt wird.

**Umsetzung:**

- Die Checklisteninstanz benötigt eine persistierte Herkunft, mindestens:
  - `vorlage` für instanziierte Pflichtpunkte,
  - `manuell` für am Auftrag ergänzte Punkte.
- Durch `ensure` oder das serverseitige Gate erzeugte Vorlagenpunkte erhalten die Herkunft
  `vorlage`.
- Über „Punkt hinzufügen“ erzeugte Punkte erhalten die Herkunft `manuell`.
- Die serverseitige Löschaktion weist das Löschen eines Vorlagenpunkts immer zurück.
- Die UI darf bei Vorlagenpunkten keine Löschaktion anbieten.
- Die Vollständigkeitsprüfung betrachtet alle aktiven Pflicht- und Zusatzpunkte. Ein Auftrag
  darf nur abgeschlossen werden, wenn alle aktiven Punkte erledigt sind.
- Bestehende Checklisten ohne Herkunft müssen bei der Datenbankänderung sicher eingeordnet
  werden. Fail-safe-Vorgabe: Nicht eindeutig zuordenbare bestehende Punkte zunächst als
  Pflichtpunkte behandeln, damit keine Pflichtprüfung abgeschwächt wird.

**Abnahmekriterien:**

- Ein Vorlagenpunkt kann über UI und direkten API-Aufruf nicht gelöscht werden.
- Ein manueller Punkt kann gelöscht werden.
- Das Entfernen offener Pflichtpunkte kann das „Erledigt“-Gate nicht umgehen.
- Memory- und MS-SQL-Repositories bilden die Herkunft identisch ab.
- DTO-Mapping und Frontend-Modell transportieren die Herkunft, soweit sie für die UI nötig ist.
- Tests decken Seeding, manuelles Hinzufügen, beide Löschfälle und das Erledigt-Gate ab.

### 3. Löschung manueller Checklistenpunkte versionieren

**Ziel:** Eine zulässige Löschung entfernt den Punkt aus der aktiven Arbeitsansicht, bleibt aber
für Nachvollziehbarkeit und Prüfung erhalten.

**Umsetzungsvorgabe:**

- Keine physische Löschung eines manuellen Punkts ohne Historie.
- Bevorzugte einfache Lösung: Soft-Delete am Checklistenpunkt, zum Beispiel mit
  `deleted_at` und `deleted_by`, ergänzt um die bereits gespeicherten Felder `label`,
  `order_id`, `position` und Herkunft.
- Alternativ ist eine eigene unveränderliche Historientabelle zulässig, wenn dies sauberer in
  die bestehende Repository-Struktur passt.
- Normale Listen und das Erledigt-Gate berücksichtigen nur aktive Punkte.
- Die Löschaktion setzt Nutzer und Zeitpunkt serverseitig; diese Werte dürfen nicht vom Client
  vorgegeben werden.
- Die Historie muss später auswertbar sein. Eine sichtbare Historienoberfläche ist in diesem
  Arbeitspaket nicht zwingend, sofern die Daten vollständig und eindeutig gespeichert werden.

**Abnahmekriterien:**

- Ein gelöschter manueller Punkt fehlt in der aktiven Checkliste.
- In der Datenbank bleiben Auftrag, Text, Herkunft, löschender Nutzer und Zeitpunkt erhalten.
- Ein erneutes Laden des Boards zeigt den Punkt weiterhin nicht aktiv an.
- Gelöschte Punkte beeinflussen das „Erledigt“-Gate nicht.
- Tests prüfen aktive Liste, Historieninformation und Persistenz.

---

## Priorität 2 – API-Härtung und Konsistenz

### 4. Eingabegrenzen zentral festlegen

Die API muss ungültige Werte mit HTTP 400 ablehnen, bevor ein Datenbankfehler entsteht.
Mindestens zu ergänzen:

- echte Kalenderprüfung für `datum` statt nur Formatprüfung,
- fachliche Obergrenze und sinnvolle Dezimalgenauigkeit für `dauer`,
- maximale Länge für Checklistenlabels passend zur Datenbank,
- maximale Längen für Notes, Kommentare und Zeitnotizen,
- Trim-Prüfung für leere Texte und Labels,
- nichtnegative beziehungsweise fachlich gültige Boardposition,
- Prüfung jedes einzelnen Labels bei `checklist/ensure`.

Grenzwerte sind einmal zentral zu definieren und in Domain, Route und Datenbankschema konsistent
zu verwenden. Falls fachliche Grenzwerte noch nicht festgelegt sind, vor der Umsetzung gezielt
nachfragen und keine beliebigen Werte als Fachregel erfinden.

### 5. Idempotenz von Zeitbuchungen absichern

- Ein vorhandener Idempotenzschlüssel darf nur dann dieselbe Buchung zurückgeben, wenn Nutzer,
  Auftrag und relevante Nutzlast übereinstimmen.
- Ein Schlüssel eines anderen Nutzers darf niemals dessen Zeiteintrag zurückgeben.
- Gleichzeitige Requests mit demselben Schlüssel müssen kontrolliert behandelt werden; der
  eindeutige SQL-Index darf nicht als ungefilterter interner Fehler beim Benutzer enden.
- Tests müssen Wiederholung, abweichende Nutzlast, fremden Nutzer und Parallelfall abdecken.

### 6. Status, Historie und spätere Outbox atomar schreiben

Overlay und Statushistorie werden derzeit nacheinander gespeichert. Für die MS-SQL-Variante ist
eine Transaktionsgrenze vorzusehen, damit entweder beide Änderungen erfolgreich sind oder keine.
Die Lösung soll so gestaltet sein, dass der spätere DATEV-Outbox-Eintrag in dieselbe fachliche
Transaktion aufgenommen werden kann. Keine allgemeine Unit-of-Work-Abstraktion bauen, wenn eine
kleinere, gezielte Transaktionsschnittstelle ausreicht.

---

## Priorität 3 – Produktionsvorbereitung

### 7. Login absichern

Vor Produktivbetrieb ergänzen:

- Begrenzung wiederholter Loginversuche,
- zeitweise Verzögerung oder Sperre nach mehreren Fehlversuchen,
- protokollierte fehlgeschlagene Anmeldungen ohne Speicherung von Passwörtern,
- sofortige Wirkung deaktivierter Benutzer,
- dokumentierte Passwortregeln und sicherer Prozess für Passwortwechsel/-zurücksetzung.

Der akzeptierte In-Memory-Session-Store bleibt bestehen. Ein Neustart darf alle Sitzungen beenden.

### 8. Versionierte Datenbankmigrationen einführen

`server/db/schema.sql` legt fehlende Tabellen an, ändert bestehende Tabellen aber nicht zuverlässig.
Vor dem ersten produktiven Datenbestand wird ein nachvollziehbares Migrationsverfahren benötigt:

- jede Schemaänderung erhält eine eindeutige Version,
- bereits ausgeführte Migrationen werden protokolliert,
- Migrationen laufen in definierter Reihenfolge,
- Upgrade und Wiederherstellung werden mit einer Testdatenbank geprüft,
- Backup vor Migration und Vorgehen bei Fehlschlag werden dokumentiert.

Die Checklistenänderung aus diesem Arbeitsauftrag soll bereits über dieses Verfahren eingeführt
werden, damit keine zweite provisorische Schemaänderung entsteht.

### 9. Server-Linting und automatisierte Qualitätsgrenzen

- Eigenes ESLint-Setup für `server/` ergänzen und in die CI aufnehmen.
- Kritische Domain-Regeln weiterhin durch Tests absichern.
- Eine realistische Coverage-Auswertung einführen; keine hohe Prozentzahl erzwingen, die nur zu
  wertlosen Tests führt. Kritische Module wie Rollen, Zeitstatus, Checklisten und Sync müssen
  gezielt abgedeckt sein.
- Die dokumentierten Playwright-Prüfungen als reproduzierbare Testsuite im Repository ablegen
  oder die Dokumentation klar als manuelle Prüfläufe kennzeichnen.

---

## Dokumentation bereinigen

### Veraltete Datenbankangaben

PostgreSQL-Verweise müssen auf die verbindliche MS-SQL-Entscheidung korrigiert werden, besonders:

- `docs/architektur.md`,
- `docs/datev-asp-anfrage.md`.

Die ASP-Anfrage ist besonders wichtig, weil sie extern verwendet werden kann.

### Projektstatus

- `README.md` auf den tatsächlichen Stand von M2 aktualisieren.
- Den Status von `docs/m2-plan.md` mit aktuellem Datum versehen.
- Veraltende feste Testzahlen möglichst durch den Hinweis auf die CI ersetzen.
- Historische Reviewdokumente als Momentaufnahme kennzeichnen; erledigte Altbefunde nicht als
  aktuelle Anforderungen erscheinen lassen.

### Noch zu erstellende Produktionsunterlagen

Vor Produktivfreigabe werden mindestens kurze, praktisch nutzbare Dokumente benötigt für:

- Deployment, Update und Rollback,
- Backup und getestete Wiederherstellung,
- Monitoring, Fehleralarmierung und Log-Aufbewahrung,
- Datenschutz, Lösch- und Aufbewahrungsfristen,
- Benutzeranlage, Rollenwechsel und Deaktivierung,
- DATEV-Ausfall, Wiederholungen, endgültig fehlgeschlagene Übertragungen und Konflikte,
- Dateianhänge: Größenlimit, Dateitypen, Virenprüfung, Ablage und Zugriffsrechte.

Diese Unterlagen müssen nicht alle in demselben Code-Paket entstehen. Sie sind jedoch als
Voraussetzung vor Produktivbetrieb in der Roadmap zu führen.

---

## Nicht Teil dieses Arbeitsauftrags

- Persistente Speicherung von Sitzungen
- Betrieb mehrerer paralleler Backend-Instanzen
- Neue Funktionen außerhalb der genannten Befunde
- Großflächige Refactorings bestehender, funktionierender Komponenten
- Sichtbare UI für die Löschhistorie, solange die Versionierungsdaten vollständig persistiert sind

## Verbindliche Abschlussprüfung

Nach der Umsetzung müssen mindestens erfolgreich laufen:

```text
Frontend:
npm ci
npm run typecheck
npm run lint
npm test
npm run build

Backend:
cd server
npm ci
npm run typecheck
npm run lint        # nach Ergänzung des Server-Lintings
npm test
npm run build
```

Zusätzlich sind die neuen Fachregeln über API-Integrationstests zu prüfen. Der Abschlussbericht
soll die geänderten Dateien, ausgeführten Prüfungen und bewusst verbliebenen offenen Punkte nennen.
