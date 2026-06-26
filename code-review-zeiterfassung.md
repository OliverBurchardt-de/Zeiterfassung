# Code-Review: Repository „Zeiterfassung“

**Repository:** `OliverBurchardt-de/Zeiterfassung`  
**Review-Gegenstand:** Frontend-/Prototyp-Code, Dokumentation, fachliche Regeln, DATEV-Zielarchitektur, Test-/Deployment-Reife  
**Stand des Reviews:** 26.06.2026  
**Kurzurteil:** Solider Meilenstein-1-Prototyp mit guter fachlicher Dokumentation, aber noch nicht produktionsreif.

---

## 1. Zusammenfassung nach Priorität

| Priorität | Bereich | Kernaussage |
|---|---|---|
| P0 | Produktion / Sicherheit / Architektur | Backend, Authentifizierung, Rollenprüfung, serverseitige Validierung, Audit-Log und echte Persistenz fehlen noch vollständig. |
| P1 | Fachliche Korrektheit | Mehrere Regeln sind nur in der UI abgesichert; Store/Domain-Logik lässt unzulässige Zustände zu. |
| P1 | Umplanung | `approveUmplanung` aktualisiert den Monat, aber nicht `fristStart` und `fristEnde`. |
| P1 | Controlling | Leere Fristdaten können ungeplante Aufträge fälschlich als überfällig markieren. |
| P1 | Zeiterfassung / KPIs | „Heute erfasst“ misst aktuell nicht „heute“, sondern nicht freigegebene Zeiten. |
| P2 | DATEV-Anbindung | DATEV-Integration ist gut vorgedacht, aber Status-Mapping, Suborder-Writeback und Zeit-Rückschreibung müssen gegen eine Live-/Testinstanz verifiziert werden. |
| P2 | Tests / CI | Es gibt Typecheck und Lint, aber keine Tests und keine erkennbare CI-Pipeline. |
| P2 | Anhänge | Datei-Anhänge sind nur Mock/Object-URLs; ein Sicherheits- und Ablagekonzept fehlt. |
| P3 | Wartbarkeit / UX | Monatslogik, Auftragsarten, Farben und Fonts sollten weiter entkoppelt und zentralisiert werden. |

---

## 2. P0 – Blocker vor produktivem Einsatz

### P0.1 Fehlendes Backend und fehlende serverseitige Autorisierung

**Feststellung**  
Das Projekt ist laut README ausdrücklich ein Meilenstein-1-Prototyp mit Mock-Daten und ohne Backend. Backend, DATEV-Anbindung und E-Mail-Reminder sind für Meilenstein 2 vorgesehen.

**Risiko**  
Ohne Backend gibt es keine belastbare Authentifizierung, keine serverseitige Rollenprüfung, keine Transaktionssicherheit, keine zentrale Persistenz und kein Audit-Log. Für echte Kanzlei-, Mandanten- und Zeitdaten ist das nicht ausreichend.

**Empfehlung**  
Vor jedem produktiven Einsatz ein Backend einführen mit:

- eigenem Login oder später optional SSO
- serverseitiger Rollen- und Rechteprüfung
- PostgreSQL oder vergleichbarer zentraler Persistenz
- Audit-Log für Statuswechsel, Zeitbuchungen, Freigaben, Notes und Benutzeränderungen
- serverseitiger Validierung aller fachlichen Regeln
- DATEV-Adapter als abgeschottetes Modul
- keine produktive Speicherung fachlicher Daten in `localStorage`

**Priorität:** P0  
**Konfidenz:** Hoch  
**Quellen im Repo:** `README.md`, `docs/architektur.md`, `CLAUDE.md`

---

### P0.2 Rollen und Admin-Rechte sind aktuell Demo-Schalter

**Feststellung**  
Die TopBar enthält einen Rollenumschalter für Mitarbeiter/Partner und einen Admin-Toggle. Der Store startet mit `isAdmin: true`.

**Risiko**  
Jeder Nutzer der UI kann im Prototyp Partner- und Admin-Rechte simulieren. Als Demo ist das nachvollziehbar; produktiv darf keine sicherheitsrelevante Aktion allein durch UI-State freigegeben werden.

**Empfehlung**

- Rollenwechsel im produktiven Build entfernen.
- Rollen und Admin-Rechte aus dem Backend laden.
- Store-Actions nur mit Actor-Kontext ausführen.
- Backend muss jede Aktion erneut autorisieren, insbesondere:
  - Zeitfreigaben
  - Review-Freigaben
  - Benutzerverwaltung
  - Statuswechsel
  - DATEV-Writeback
  - Löschen/Archivieren von Notes und Anhängen

**Priorität:** P0  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/app/TopBar.tsx`, `src/state/store.ts`, `docs/lastenheft.md`

---

### P0.3 Persistenz in `localStorage` ist für echte Kanzleidaten ungeeignet

**Feststellung**  
Der Zustand für `orders`, `users` und `besonderheiten` wird über Zustand Persist im Browser gespeichert.

**Risiko**  
Mandantendaten, Auftragsdaten, Zeiten, Benutzerinformationen und Notizen würden im Browser liegen. Das ist für echte Kanzleidaten aus Datenschutz-, Sicherheits- und Revisionssicht ungeeignet.

**Empfehlung**

- Produktiv nur UI-State lokal speichern.
- Fachliche Daten ausschließlich serverseitig persistieren.
- Verschlüsselung, Backup, Berechtigung und Audit-Log auf Datenbank-/Backend-Ebene umsetzen.
- Migrationen für Datenmodelländerungen vorsehen.
- Browser-Cache und lokale Speicherung bewusst minimieren.

**Priorität:** P0  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/state/store.ts`, `CLAUDE.md`

---

## 3. P1 – Fachlich kritische Punkte

### P1.1 Statuswechsel werden im Store nicht zentral validiert

**Feststellung**  
Die UI verhindert den Status „Erledigt“, wenn die Checkliste nicht vollständig ist. Der Store selbst setzt mit `setStatus` aber jeden übergebenen Status direkt.

**Risiko**  
Andere Komponenten, spätere API-Aufrufe oder Tests können fachlich unzulässige Zustände erzeugen. Die wichtigste Geschäftsregel hängt damit an der UI statt an der Domain-Logik.

**Empfehlung**

Eine zentrale Domain-Funktion einführen, z. B.:

```ts
changeOrderStatus(order, targetStatus, actor)
```

Diese Funktion sollte prüfen:

- Checkliste vollständig vor `er`
- `ua`/`uv` nur bei Auftragsarten mit Unterlagenprozess
- zulässige Statusübergänge
- offene Review Notes
- offene Zeitfreigaben, sofern fachlich gewünscht
- Rollenrechte
- DATEV-Writeback-Mapping

Der Store sollte `setStatus` nicht mehr direkt offen anbieten, sondern nur über diese validierte Funktion gehen.

**Priorität:** P1  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/features/board/Board.tsx`, `src/features/order/OrderModal.tsx`, `src/state/store.ts`, `src/state/selectors.ts`

---

### P1.2 `approveUmplanung` aktualisiert keine Fristdaten

**Feststellung**  
`planOrder` setzt bei Einplanung `monat`, `fristStart` und `fristEnde`.  
`approveUmplanung` setzt dagegen nur `monat` und löscht die Umplanung.

**Risiko**  
Nach Freigabe einer Umplanung kann der angezeigte Monat von den internen Planungsdaten abweichen. Für DATEV-Writeback ist das gefährlich, weil `planned_start` und `planned_end` fachlich maßgeblich sind.

**Empfehlung**

`approveUmplanung` sollte wie `planOrder` `monatBounds(zielMonat)` verwenden:

```ts
approveUmplanung: (orderId) => set((s) => ({
  orders: mapOrder(s.orders, orderId, (o) => {
    if (!o.umplanung) return o;
    const b = monatBounds(o.umplanung.zielMonat);
    return b
      ? {
          ...o,
          monat: o.umplanung.zielMonat,
          fristStart: b.start,
          fristEnde: b.end,
          umplanung: null,
        }
      : o;
  }),
}))
```

**Priorität:** P1  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/state/store.ts`, `src/lib/monate.ts`, `docs/datev-integration.md`

---

### P1.3 Ungeplante Aufträge können als überfällig erscheinen

**Feststellung**  
`istUeberfaellig` vergleicht `o.fristEnde < HEUTE`. Ungeplante Aufträge haben leere Fristfelder.

**Risiko**  
Leere Strings können im Vergleich mit einem ISO-Datum zu falschen Ergebnissen führen. Außerdem kann die Anzeige mit `new Date('')` ungültige Datumswerte erzeugen.

**Empfehlung**

Vor jedem Datumsvergleich validieren:

```ts
export function istUeberfaellig(o: Order): boolean {
  if (!o.fristEnde) return false;
  return o.fristEnde < HEUTE && o.status !== 'er';
}
```

Besser zusätzlich: zentrale Datumsfunktionen, die nur gültige ISO-Daten akzeptieren.

**Priorität:** P1  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/state/selectors.ts`, `src/mock/orders.ts`, `src/features/controlling/ControllingView.tsx`

---

### P1.4 „Heute erfasst“ ist fachlich falsch oder missverständlich

**Feststellung**  
Die Funktion `heuteErfasst` filtert nicht nach dem heutigen Datum. Sie summiert nicht freigegebene Zeiten der gefilterten Aufträge.

**Risiko**  
Die Kennzahl „Heute erfasst“ zeigt nicht, was der Name verspricht. Nutzer könnten daraus falsche Rückschlüsse auf Tagesleistung oder Arbeitszeit ziehen.

**Empfehlung**

Entweder Kennzahl umbenennen, z. B. in „Nicht freigegeben“, oder korrekt berechnen:

- Filter nach heutigem Datum
- Filter nach angemeldetem Nutzer
- Summe aller heute gebuchten Zeiten, unabhängig vom Freigabestatus
- getrennte Anzeige: „heute erfasst“ und „davon offen“

Zusätzlich sollte eine Zeitbuchung künftig den Erfasser eindeutig speichern, nicht nur indirekt über den aktuellen Bearbeiter des Auftrags.

**Priorität:** P1  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/state/selectors.ts`, `src/features/board/RightColumn.tsx`, `src/lib/types.ts`

---

### P1.5 Zeitbuchungen werden nur in der UI validiert

**Feststellung**  
Die UI prüft bei manuellen Zeiten, ob die Dauer positiv ist und ob eine Pflichtnotiz vorhanden ist. Die Store-Action `addManualTime` selbst validiert die Eingaben nicht.

**Risiko**  
Spätere Komponenten oder API-Aufrufe können ungültige Zeiten speichern, z. B. negative Dauer, unrealistische Dauer, fehlende Pflichtnotiz oder fehlende Aufwandsart.

**Empfehlung**

Zeitbuchungen über eine zentrale Validierungsfunktion führen:

```ts
validateTimeEntry(order, input, actor)
```

Prüfen sollte diese Funktion mindestens:

- Dauer > 0
- Dauer nicht unrealistisch hoch
- Datum gültig
- Pflichtnotiz bei Beratung/Mehraufwand
- Aufwandsart bei Mehraufwand
- Erfasser vorhanden
- Status des Auftrags erlaubt Buchung
- ggf. keine Buchung auf archivierte/gelöschte DATEV-Aufträge

**Priorität:** P1  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/features/time/TimePanel.tsx`, `src/features/time/QuickTimeDialog.tsx`, `src/state/store.ts`, `src/lib/art.ts`

---

### P1.6 Review-/Note-Regeln sind teilweise nur in der UI umgesetzt

**Feststellung**  
`notePolicy` beschreibt Rollenregeln. Die UI verwendet diese Regeln für Buttons. Die Store-Actions `setNoteState`, `deleteNote`, `editNoteText`, `addComment` und `addAttachments` prüfen selbst aber keine Rollenrechte.

**Risiko**  
Unzulässige Note-Zustände oder Löschungen sind möglich, sobald Aktionen nicht ausschließlich über die aktuellen UI-Buttons erfolgen.

**Empfehlung**

Store-/Backend-Aktionen nur über validierte Domain-Funktionen:

- `createNote`
- `changeNoteState`
- `deleteNote`
- `editNote`
- `addNoteAttachment`

Jede Funktion sollte Actor, Rolle, Note-Art und aktuellen Zustand prüfen.

**Priorität:** P1  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/lib/tokens.ts`, `src/features/notes/NotesSection.tsx`, `src/state/store.ts`

---

## 4. P2 – Hohe, aber nicht unmittelbar blockierende Verbesserungspunkte

### P2.1 DATEV-Integration braucht technischen Spike

**Feststellung**  
Die DATEV-Integration ist konzeptionell gut dokumentiert. Offen sind aber Status-Mapping, Suborder-Writeback, Zeit-Rückschreibung und Auftragsart-Mapping.

**Risiko**  
Die spätere Implementierung kann an API-Details scheitern, wenn die Live-/Testinstanz anders reagiert als erwartet. Besonders kritisch ist, dass PUT nach Dokumentation vollständige Objekte überschreibt.

**Empfehlung**

Vor M2 ein separates technisches Spike durchführen:

- Testauftrag per GET lesen
- Statuswechsel per PUT testen
- `planned_start` und `planned_end` zurückschreiben
- Suborder mit `date_work_completed` testen
- Konfliktverhalten prüfen
- Rechte des DATEVconnect-Benutzers prüfen
- Fehlerszenarien dokumentieren
- Zeit-Rückschreibung final klären: API, Summenrückschreibung oder Export-/Import-Fallback

**Priorität:** P2  
**Konfidenz:** Hoch  
**Quellen im Repo:** `docs/datev-integration.md`, `docs/architektur.md`, `docs/lastenheft.md`

---

### P2.2 Tests fehlen

**Feststellung**  
`package.json` enthält Skripte für Dev, Build, Preview, Typecheck und Lint, aber kein Testskript. Test-Dependencies sind nicht erkennbar.

**Risiko**  
Fachliche Regeln können bei späteren Änderungen unbemerkt brechen. Gerade bei DATEV-Writeback und Zeiterfassung sind Regressionen teuer.

**Empfehlung**

Einführen:

- Vitest für Unit-Tests
- React Testing Library für Komponenten
- Playwright für zentrale E2E-Flows
- Tests für:
  - `canComplete`
  - `istUeberfaellig`
  - `heuteErfasst`
  - `approveUmplanung`
  - Statuswechsel
  - Note-Workflow
  - Pflichtnotizen
  - Aufwandsarten
  - Filterlogik

**Priorität:** P2  
**Konfidenz:** Hoch  
**Quellen im Repo:** `package.json`, `src/state/selectors.ts`, `src/state/store.ts`

---

### P2.3 CI-Pipeline fehlt

**Feststellung**  
Im Review wurde keine `.github/workflows/ci.yml` gefunden.

**Risiko**  
Build-, Lint- und Typecheck-Fehler werden nicht automatisch bei Push oder Pull Request erkannt.

**Empfehlung**

GitHub Actions Workflow einführen:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
```

Sobald Tests eingeführt sind: `npm test` ergänzen.

**Priorität:** P2  
**Konfidenz:** Mittel  
**Quellen im Repo:** `package.json`, `.github/workflows/ci.yml` nicht vorhanden

---

### P2.4 Attachment-Konzept fehlt

**Feststellung**  
Anhänge werden derzeit als Mock über `URL.createObjectURL` erzeugt. Die Doku sieht echte Dateiablage erst für M2 vor.

**Risiko**  
Produktiv fehlen Zugriffsschutz, Dateitypprüfung, Größenlimits, Speicherung, Löschlogik und Virenprüfung.

**Empfehlung**

Für M2 definieren:

- maximale Dateigröße
- erlaubte Dateitypen
- serverseitige MIME-/Extension-Prüfung
- Virenscan oder Quarantäneprozess
- Storage-Key statt frei übergebener URL
- Berechtigungsprüfung je Auftrag
- Audit-Log für Upload/Löschung
- Aufbewahrungs- und Löschkonzept
- im Frontend bei Object-URLs `URL.revokeObjectURL` verwenden

**Priorität:** P2  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/features/notes/NotesSection.tsx`, `docs/lastenheft.md`

---

### P2.5 Auftragsarten sind hartcodiert

**Feststellung**  
Auftragsarten, Farben, Unterlagenprozess, Pflichtnotiz, Besonderheiten und laufende Arten sind im Code fest hinterlegt.

**Risiko**  
DATEV liefert Auftragsarten als Nummern. Kanzleispezifische Auftragsarten lassen sich so nicht flexibel abbilden.

**Empfehlung**

Auftragsart-Konfiguration in M2 in die Datenbank verlagern:

- DATEV-Auftragsartnummer
- App-ArtKey
- Label/Kürzel
- Farbe
- Unterlagenprozess ja/nein
- Checklisten-Vorlage
- Pflichtnotiz ja/nein
- laufende Buchung ja/nein
- Besonderheiten verfügbar ja/nein

**Priorität:** P2  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/lib/art.ts`, `docs/datev-integration.md`, `docs/lastenheft.md`

---

## 5. P3 – Wartbarkeit, UX und technische Hygiene

### P3.1 Monatslogik ist uneinheitlich und hartcodiert

**Feststellung**  
Das OrderModal verwendet eine feste Liste `Jan 2025` bis `Jun 2025`. Die Planung verwendet dagegen einen 15-Monats-Horizont ab Januar 2025.

**Risiko**  
Die UI verhält sich je Modul unterschiedlich. Änderungen am Planungszeitraum müssen an mehreren Stellen erfolgen.

**Empfehlung**

Eine zentrale Kalender-/Monatsquelle einführen:

- Planungszeitraum aus Konfiguration
- Monatsliste aus aktuellem Datum oder Geschäftsjahr
- Feiertage und Urlaub später aus DATEV oder eigener Kapazitätslogik
- einheitliche Labels und ISO-Werte

**Priorität:** P3  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/features/order/OrderModal.tsx`, `src/features/planung/PlanungView.tsx`, `src/lib/monate.ts`

---

### P3.2 Fonts werden extern über Google Fonts geladen

**Feststellung**  
Aleo wird per Google Fonts importiert, Petrona lokal geladen.

**Risiko**  
Für eine interne Kanzlei-App ist ein externer Font-Aufruf unnötig und kann Datenschutz-/Verfügbarkeitsfragen auslösen.

**Empfehlung**

Alle Fonts lokal ausliefern oder vollständig auf System-Fonts umstellen.

**Priorität:** P3  
**Konfidenz:** Hoch  
**Quellen im Repo:** `src/styles/tokens.css`

---

### P3.3 Vite-Server ist mit `host: true` konfiguriert

**Feststellung**  
Der Dev-Server bindet mit `host: true`.

**Risiko**  
Für lokale Tests im Netzwerk ist das nützlich. Es sollte aber klar als Development-Setting behandelt werden und nicht als produktionsnahe Bereitstellung missverstanden werden.

**Empfehlung**

- Produktionsdeployment klar getrennt dokumentieren.
- Dev-Server nicht als interne Produktiv-App verwenden.
- Backend/Frontend produktiv über HTTPS und Reverse Proxy ausliefern.

**Priorität:** P3  
**Konfidenz:** Hoch  
**Quellen im Repo:** `vite.config.ts`, `docs/architektur.md`

---

### P3.4 Farben sind teilweise doppelt definiert

**Feststellung**  
Design-Tokens existieren in CSS und TypeScript. Gleichzeitig werden Farben an mehreren Stellen direkt als Hex-Werte verwendet.

**Risiko**  
Design-Änderungen müssen an mehreren Stellen synchronisiert werden.

**Empfehlung**

- Farben stärker über CSS-Variablen oder ein zentrales Mapping führen.
- Hex-Werte in Komponenten vermeiden.
- Falls TypeScript-Mapping nötig ist, aus einer gemeinsamen Quelle generieren oder konsequent spiegeln.

**Priorität:** P3  
**Konfidenz:** Mittel  
**Quellen im Repo:** `src/styles/tokens.css`, `src/lib/tokens.ts`, `src/lib/art.ts`

---

## 6. Empfohlene Reihenfolge der Umsetzung

### Sofort beheben

1. `approveUmplanung` korrigieren.
2. `istUeberfaellig` gegen leere/ungültige Fristdaten absichern.
3. „Heute erfasst“ fachlich korrigieren oder umbenennen.
4. Store-Actions für Status, Zeiten und Notes zentral validieren.
5. Testbasis für Selektoren und Store einführen.

### Vor Meilenstein 2

1. Backend-Architektur konkretisieren.
2. DB-Schema entwerfen.
3. Auth-/Rollenmodell festlegen.
4. DATEV-Spike durchführen.
5. Auftragsart-Mapping als Konfiguration modellieren.
6. Attachment-Konzept definieren.
7. CI einführen.

### Vor Produktivbetrieb

1. Vollständige serverseitige Validierung.
2. Audit-Log.
3. HTTPS/Reverse Proxy/Deployment-Konzept.
4. Backup- und Restore-Konzept.
5. Rechte- und Rollentests.
6. Datenschutz-/IT-Sicherheitsprüfung.
7. E2E-Test der wichtigsten Kanzleiprozesse.

---

## 7. Gesamtbewertung

Der Code ist als **M1-Prototyp** gut strukturiert und fachlich erstaunlich weit gedacht. Die Dokumentation zeigt bereits viele richtige Architekturentscheidungen, insbesondere zur DATEVconnect-Netzwerkebene und zur Trennung zwischen Frontend, Backend, DATEV-Adapter und eigener Persistenz.

Die größten Risiken liegen nicht im UI-Code selbst, sondern in der derzeit fehlenden produktionsfähigen Absicherung:

- keine echte Authentifizierung
- keine serverseitige Rechteprüfung
- keine zentrale Domain-Validierung
- keine Tests
- keine CI
- keine echte Persistenz
- keine verifizierte DATEV-Rückschreibung
- kein Audit-Log

**Konfidenzniveau des Reviews:** Hoch für die geprüften Dateien und konkreten Befunde; mittel für vollständige Repo-Abdeckung, weil das Repository laut GitHub-Connector nicht für Code Search indexiert war und der Build nicht lokal ausgeführt wurde.
