# Eigen-Review (Zweitgutachten): Zeiterfassung & Auftragsabwicklung

Stand: 22. Juni 2026  
Kontext: M1-Mock-up ohne Backend, Desktop-Arbeitsplätze in der Kanzlei  
Methodik: Zwei unabhängige Reviews mit eigenem, leerem Kontext (technischer Code-Review +
UI/Fach-Review), anschließend zusammengeführt und im Code gegengeprüft. Ergänzt das externe
Kollegen-Review (`2026-06-22-ui-fachreview.md`) und wiederholt dessen Punkte nicht.

## Kurzfazit

Die Architektur ist sauber und regeltreu: `orders[]` als Single Source of Truth, alle Mutationen
immutabel, Status über `setStatus` (Board + Modal), Notes-Rollen-Policy zentral in `notePolicy`,
Tokens statt Hardcode-Hex, keine Emojis, durchgängig gute Empty States und Formvalidierung. Es
wurden jedoch **drei echte Bugs** gefunden (Note-Freigabe überspringt den Workflow, „Heute
erfasst" rechnet ohne Datumsbezug, „Nicht abgerechnet" wertet unbestätigte Zeiten) sowie mehrere
produktionskritische Konzeptlücken — allen voran, dass die App **keine konsistente Identität des
angemeldeten Nutzers** kennt und das **Rollen-Gating fast überall rein UI-seitig** (`disabled`)
erfolgt.

Stand der Umsetzung: Die mit ✅ markierten Punkte wurden im Zuge dieses Reviews bereits behoben.

---

## 1. Bugs (im Code verifiziert)

### ✅ 1.1 Review-Note-Freigabe übersprang den Workflow
`src/features/notes/NotesSection.tsx`
Der „Freigeben"-Button prüfte nur die Partner-Rolle, nicht `noteState === 'erledigt'`. Ein Partner
konnte eine Review-Note direkt aus `offen` freigeben — entgegen dem vorgeschriebenen Ablauf
`offen → erledigt → freigegeben`. **Fix:** Bedingung um `note.noteState === 'erledigt'` ergänzt
(konsistent zu `offeneReviewFreigaben` und zur FreigabenView).

### ✅ 1.2 „Heute erfasst" zählte nicht „heute"
`src/state/selectors.ts` (`heuteErfasst`)
Die Funktion summierte *alle nicht-freigegebenen* Zeiten ohne Datumsbezug; der Tagesbalken rechts
maß damit „offene Stunden gesamt" statt den heutigen Ist — und sank, sobald Zeiten freigegeben
wurden. **Fix:** Filter auf `t.datum === HEUTE`, unabhängig vom Freigabestatus.

### ✅ 1.3 „Nicht abgerechnet" wertete unbestätigte Zeiten
`src/state/selectors.ts` (`istNichtAbgerechnet`)
War `!fakturiert && times.length > 0` — zählte also auch noch nicht freigegebene Buchungen als
Abrechnungsrückstand. **Fix:** `!fakturiert && times.some(t => t.freigegeben)`.

### ✅ 1.4 Leere Monatsoption im Filter
`src/features/board/FilterSidebar.tsx`
Pool-Aufträge mit `monat: ''` erzeugten eine leere, unbeschriftete `<option>` im Dropdown
„Geplanter Monat". **Fix:** leere Monate herausgefiltert (`.filter(Boolean)`).

---

## 2. Produktionskritische Konzeptlücken (M2 / Workshop)

### 2.1 Identität ≠ Rolle (Muss)
`CURRENT_USER` ist eine feste Konstante (`EMPLOYEES[0]`) und reagiert nicht auf den
Rollen-Umschalter. Folgen: „Meine Zeiten" zeigt immer denselben Mitarbeiter (auch als Partner);
der Note-Autor wird aus dem Auftrags-Partnerfeld statt aus dem eingeloggten Nutzer abgeleitet; der
User-Chip kombiniert festen Namen mit Toggle-Rolle. Zusätzlich sind `EMPLOYEES`/`CURRENT_USER` und
`users[]` (Verwaltung) zwei getrennte Quellen für Mitarbeiter-Stammdaten. **Empfehlung:** In M2
eine Identität (eingeloggter User aus `users[]`) als Quelle; „Meine Zeiten", Autorenschaft,
Filter-Default und Reminder daran hängen.

### 2.2 Rollen-Gating nur in der UI (Muss)
Die Freigabe-Actions im Store (`approveTime`, `approveUmplanung`, `setNoteState`) haben keine
Rollenprüfung; abgesichert wird nur über `disabled`/bedingtes Rendern. Zudem sind Zeit- und
Umplanungs-Freigaben — anders als Notes — gar nicht in einer zentralen Policy erfasst.
**Empfehlung:** Zentrale Policy analog `notePolicy` für Zeit-/Umplanungs-Freigaben; in M2
server-seitig erzwingen. (Die Notes-Policy ignoriert bisher den Urheber-/Zuständigkeitsbezug —
jeder Mitarbeiter könnte fremde Fragen schließen/löschen; ebenfalls erst in M2 relevant.)

### 2.3 Auftrags-Zuweisung fehlt in der UI (Muss)
`assignOrder` existiert im Store, wird aber von keiner Komponente aufgerufen; `bearbeiter`/`partner`
sind read-only. Es gibt also keinen Weg, einen Auftrag (um-)zuweisen — die konkrete Vorstufe zum
Kollegen-Thema „Vertretung/Teamarbeit".

### 2.4 DATEV-geführte Felder klar kennzeichnen (Muss, deckt sich mit Kollege 1.3/5.4)
✅ Die Plandaten-Felder im Detail (Zeitraum, Soll-Stunden) waren `defaultValue` ohne Speicherfluss;
sie wurden auf `readOnly` gesetzt und als „aus DATEV EO" gekennzeichnet (Änderung des Zeitraums
läuft über „Umplanung"). Offen bleibt die generelle M2-Frage, welche Felder die App schreiben darf
und welcher Änder-/Freigabefluss nach DATEV gilt.

### 2.5 Audit-Trail — konkrete Stellen (Muss, ergänzt Kollege 2.6)
Mutationen komplett ohne Spur: `setStatus` (kein Wer/Wann/Grund), `approveTime` (kein
Freigeber/Zeitpunkt), `setSuborderDone` (nur Datum, kein Bearbeiter), Besonderheiten-Edits,
Checklisten-Add/Remove. Für Status, Freigaben und Suborder-Erledigung in M2 zwingend.

---

## 3. Weitere fachliche Lücken (Sollte)

- **Teilaufträge (FiBu/Lohn):** „erledigt" je Monat ist beliebig klickbar (keine Plausibilität
  gegen erfasste Zeit); keine Zeitbuchung je Monat (für M2 vorgesehen); der Monatsfortschritt
  erscheint nicht auf der Board-Karte, obwohl er bei laufenden Mandaten die zentrale Steuerinfo ist.
- **Mandantenbesonderheiten:** keine Änderungs-Historie (`editBesonderheit` überschreibt in-place),
  kein Rollen-Gating, und der periodenübergreifende Wirkungsbereich wird dem Nutzer nicht erklärt.
- **Aufwandsart geht im normalen Timer verloren:** Mehraufwand braucht eine Aufwandsart; erfasst
  wird sie nur im `QuickTimeDialog`, nicht im regulären `TimePanel` → direkte Timer-Buchung auf
  einem Mehraufwand-Auftrag hat `aufwandsart = undefined` (lückenhafte DATEV-Rückspiegelung).
- **Zeiten nicht editier-/stornierbar:** kein `editTime`/`removeTime`; Korrektur nur durch
  Neuanlage (Doppelbuchungen). Freigegebene Zeiten haben keinen definierten Rückweg.
- **Inkonsistentes Modul-Gating:** nur „Verwaltung" ist über `isAdmin` gegated; Controlling,
  Planung und Freigaben sind für jede Rolle voll nutzbar (Controlling ist laut Code-Kommentar als
  Leitungssicht gedacht, erzwingt das aber nicht).
- **Hartkodierte Monatslisten** im Detail/Umplanung (`OrderModal`: Jan–Jun 2025), während der
  Filter die Monate dynamisch zieht.

---

## 4. Stil / Nice-to-have

- ✅ `addNote` leitete `kind` inline aus der Rolle ab statt über `notePolicy.canCreateKind` — auf
  die zentrale Policy umgestellt.
- Timer-State (`timerSec`/`timerRunning`) hängt am Order-Objekt und wird mitpersistiert; laut
  CLAUDE.md soll Timer reiner lokaler UI-State sein. Für M2 aus dem Order-Modell lösen bzw. von der
  Persistenz ausnehmen; Tick robust über gespeicherten Startzeitpunkt (deckt Kollege 5.3 ab).
- Vier nahezu identische lokale `Kpi`/`Section`/`Empty`/`Row`-Helfer (Controlling/Freigaben/Zeiten)
  → in eine gemeinsame Komponente extrahieren.
- Datums-/Zeitzonen-Handling (`monatBounds`/`HEUTE`, String-Vergleiche) für M2 vereinheitlichen.
- Note ohne Text wird als „(ohne Text)" angelegt → besser Text **oder** Anhang verlangen.

---

## 5. Abgleich mit dem Kollegen-Review

- **5.1 (Umplanung Plandaten):** ✅ behoben (`approveUmplanung` setzt jetzt `fristStart`/`fristEnde`).
- **5.2 (Überfälligkeit ungeplant):** ✅ behoben (`istUeberfaellig` ignoriert leeres `fristEnde`).
- **5.3 (Timer am Panel):** bestätigt — siehe Abschnitt 4 (Timer-Modell für M2).
- **5.4 / 1.3 (Schein-Editierbarkeit):** ✅ Plandaten-Felder auf read-only gesetzt; generelle
  Änder-/Freigabe-Logik bleibt M2-Thema.
- **1.1 (Board-Dichte):** leichte Präzisierung — dringlicher als ein weiteres „Heute kritisch"-Panel
  war, die bestehende Tagessicht korrekt rechnen zu lassen (1.2) und die Identität zu klären (2.1).

---

## 6. Was gut gelöst ist

Notes-Rollen-Policy zentral und sauber durchgesetzt (inkl. Lock nach Freigabe, kind-bewusster
„Offen"-Zählung über `noteOffen`); Checklisten-Gate (`canComplete`) in beiden Pfaden erzwungen
(OrderModal + Board); Freigaben-Cockpit als echtes Partner-Werkzeug; `ua`/`uv`-Spalten korrekt
auftragsartabhängig; laufende Arten konsequent aus Board/Controlling/Planung ausgefiltert;
`besKey`-Modell für periodenübergreifende Besonderheiten; durchgängige Empty States und
Formvalidierung; Schutz gegen Division durch 0 in `auslastungPct`/`monatBounds`.

---

## 7. Empfehlung zum weiteren Vorgehen

Die Bugs aus Abschnitt 1 sind behoben. Die Muss-Punkte aus Abschnitt 2 (Identität, Gating-Konzept,
Zuweisung, DATEV-Schreibregeln, Audit-Trail) sind Architektur-/Fachentscheidungen und gehören in
den vom Kollegen vorgeschlagenen Fachworkshop, bevor sie gebaut werden — gemeinsam mit den dort
offenen Themen (Reminder-Matrix, Status-Governance, DATEV-Sync-/Konfliktzustände, Vertretung).
