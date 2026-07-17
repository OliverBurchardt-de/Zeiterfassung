# Konzept: Synchronisierung im Produktivbetrieb (DATEV ↔ App)

> Status: **abgestimmt, Grundgerüst umgesetzt.** Beantwortet die Frage: „Wie kommen die
> DATEV-Daten automatisch in die App, ohne dass jemand bei jedem Login 35 Sekunden wartet?"
> Ergänzt `docs/architektur-entscheidungen.md` (ADR-06 Outbox) und `docs/m2-plan.md`.

## 1. Das Problem in einem Satz

Heute holt die App die Aufträge **live aus DATEV, wenn jemand das Board öffnet** — dieser Abruf
dauert am Echtsystem ~35 Sekunden. Für einen Testrechner mit einer Person ist das egal; für den
Produktivbetrieb mit mehreren Mitarbeitern, die sich morgens einloggen, ist es untragbar.

## 2. Die Lösung in einem Satz

Die App liest **nicht mehr direkt aus DATEV**, sondern aus einer **eigenen lokalen Kopie**. Ein
**Hintergrund-Programm** hält diese Kopie aktuell — **nachts einmal komplett** und tagsüber optional
in kleinen Abständen. Wenn sich morgens jemand einloggt, ist alles schon da (Millisekunden).

## 3. Was ist so ein „nächtlicher Lauf" überhaupt? (die Kernfrage)

**Ja, es ist ein Programm — und ja, es liegt auf dem Server und läuft dauerhaft.** So muss man es
sich vorstellen:

- Der **Server** (unser App-Backend, `server/`) ist ein Programm, das **rund um die Uhr läuft** —
  es muss ohnehin immer laufen, damit sich Leute anmelden können. Es ist kein Programm, das man
  „aufruft" und das dann endet, sondern ein **Dienst**, der wartet und auf Anfragen reagiert.
- In diesem laufenden Server steckt eine **eingebaute Uhr** (der „Zeitplaner"). Die rechnet aus:
  *„Wie lange ist es noch bis 05:00 Uhr?"* — und stellt sich einen **Wecker** auf genau diese Zeit.
- Um 05:00 klingelt der Wecker, das Programm **wacht von selbst auf**, holt die DATEV-Daten, legt
  sie in der eigenen Datenbank ab, und **stellt den Wecker sofort neu** auf 05:00 am nächsten Tag.
- **Niemand muss etwas anklicken.** Kein Mensch startet den Lauf, kein Mitarbeiter merkt etwas
  davon. Es passiert, während alle schlafen.

**Analogie:** wie ein Heizungsthermostat mit Zeitschaltuhr. Man stellt einmal „jeden Morgen um 5
warm" ein — danach macht es das jede Nacht von selbst, solange der Strom (= der laufende Server) da
ist. Zieht man den Stecker (Server aus), passiert nichts; steckt man ihn wieder ein, geht es weiter.

**Wichtig:** Der Wecker lebt **im Server-Programm selbst**, nicht in Windows. Solange der Server
läuft, läuft der Wecker. Wird der Server neu gestartet, holt er beim Hochfahren **einmal sofort**
die Daten (damit die Kopie nie leer ist) und stellt den Wecker dann wieder auf 05:00.

> Es gäbe auch die Alternative, den Windows-**Aufgabenplaner** (Task Scheduler) zu nutzen, der zu
> festen Zeiten ein Programm startet. Wir machen es **bewusst im Server selbst** — dann ist der
> Zeitplan Teil der Anwendung (versioniert, getestet, überall gleich) und man muss auf dem Server
> nichts getrennt einrichten. Falls IT es später lieber über Windows steuern will, ist auch das
> möglich (derselbe Sync lässt sich von außen anstoßen).

## 4. Zwei Richtungen — nicht verwechseln

Synchronisierung meint zwei verschiedene Wege:

### Richtung A — DATEV → App (Lesen)
Aufträge, Teilaufträge, Mandantennamen aus DATEV in die eigene Datenbank holen.

- **Nächtlicher Voll-Lauf** (Standard 05:00): alle relevanten Aufträge frisch spiegeln.
- **Optionaler Delta-Lauf tagsüber** (z. B. alle 30 Min., standardmäßig aus): nur frisch Geändertes
  nachziehen, damit ein neu angelegter Auftrag nicht bis zum nächsten Morgen fehlt.
- **Ergebnis:** Login und Board sind **sofort** da. Die 35 Sekunden erlebt niemand mehr — sie
  passieren nachts, wenn keiner wartet.

### Richtung B — App → DATEV (Rückschreiben)
Erfasste, **freigegebene** Zeiten und Statusänderungen zurück nach DATEV buchen.

- Jede Rückschreibung wird zuerst in eine **Warteschlange** gelegt (die „Outbox", ADR-06) — nicht
  sofort verschickt.
- Ein **Outbox-Arbeiter** (zweiter Hintergrund-Wecker, z. B. alle 5 Min.) arbeitet die
  Warteschlange ab und bucht die Einträge nach DATEV.
- **Vorteil:** Ist DATEV oder das VPN kurz nicht erreichbar, geht **nichts verloren** — der Eintrag
  bleibt in der Warteschlange und wird beim nächsten Durchlauf erneut versucht. Erst nach mehreren
  Fehlversuchen wird ein Eintrag als „endgültig fehlerhaft" markiert (zur manuellen Prüfung), statt
  ewig weiterzuprobieren.

## 5. Wie es technisch gebaut ist (die Bausteine)

Alles liegt in `server/src/sync/`:

| Baustein | Datei | Aufgabe |
|---|---|---|
| **Snapshot** | `orderSnapshot.ts` | die lokale Kopie der DATEV-Aufträge + Mandanten (im Speicher des laufenden Servers) |
| **Sync-Job (Lesen)** | `syncOrders.ts` | holt Aufträge/Mandanten aus DATEV und legt sie in den Snapshot |
| **Lese-Weiche** | `snapshotDatev.ts` | das Board liest über diese Weiche: ist der Snapshot gefüllt → sofort daraus; sonst einmalig live nachladen und ablegen |
| **Zeitplaner** | `scheduler.ts` | die „innere Uhr": rechnet bis 05:00, stellt den Wecker, wiederholt täglich; plus Intervall-Wecker für Delta/Outbox |
| **Outbox-Arbeiter (Schreiben)** | `outboxWorker.ts` | leert die Rückschreibe-Warteschlange nach DATEV, mit Wiederholung bei Fehlern |

Verdrahtet wird das beim Serverstart (`server/src/server.ts`), gesteuert über die Konfiguration
(`.env`) — siehe nächster Abschnitt.

## 6. Einstellungen (`.env`)

Alle Zeiten/Schalter sind konfigurierbar, ohne den Code zu ändern:

| Einstellung | Standard | Bedeutung |
|---|---|---|
| `SYNC_ENABLED` | an bei Echtdaten (`DATEV_MODE=http`) | Lese-Sync + Lese-Weiche aktiv |
| `SYNC_NIGHTLY_AT` | `05:00` | Uhrzeit des nächtlichen Voll-Laufs (24-h-Format `HH:MM`) |
| `SYNC_DELTA_EVERY_MIN` | `0` (aus) | Abstand des Delta-Laufs in Minuten; 0 = kein Delta |
| `SYNC_OUTBOX_ENABLED` | an bei Echtdaten | Outbox-Arbeiter aktiv (Rückschreiben) |
| `SYNC_OUTBOX_EVERY_MIN` | `5` | Abstand, in dem die Warteschlange abgearbeitet wird |

Im **Demo-/Mock-Modus** ist alles aus — dort ändert sich nichts.

## 7. Bewusste Grenzen dieses ersten Ausbaus (ehrlich)

- Der Snapshot liegt vorerst **im Arbeitsspeicher** des laufenden Servers, nicht dauerhaft in der
  Datenbank. Folge: Nach einem **Server-Neustart** ist er kurz leer und wird beim Hochfahren einmal
  frisch geholt (die bekannten ~35 s **einmal**, nicht pro Login). Für den Dauerbetrieb ist das in
  Ordnung, weil der Server durchläuft. **Optionale Härtung später:** den Snapshot zusätzlich in der
  MS-SQL-Datenbank ablegen, dann ist er auch direkt nach einem Neustart sofort da.
- Der **Delta-Lauf** zieht heute denselben (gefilterten) Voll-Abzug — ein echtes „nur Geändertes
  seit Zeitpunkt X" über einen DATEV-Änderungsfilter ist ein späterer Feinschliff, sobald am
  Echtsystem geklärt ist, welches Feld DATEV dafür zuverlässig liefert.
- Das **Befüllen der Outbox** aus den Fach-Aktionen (jede freigegebene Zeit erzeugt einen
  Warteschlangen-Eintrag) ist der zugehörige nächste Schritt in Richtung B; der Arbeiter, der die
  Warteschlange **leert**, steht bereits.

## 8. Verifikation

- **Automatisiert (im Container, ohne DATEV-Netz):** Zeitmathematik des Zeitplaners
  (`msUntilTime`), Füllen des Snapshots durch den Sync-Job, Lese-Weiche (Snapshot statt live),
  Outbox-Abarbeitung inkl. Wiederholung/endgültigem Fehler — alles als Unit-Tests
  (`server/src/sync/sync.test.ts`). Default-Modus (Mock) startet unverändert; bestehende Tests grün.
- **Am Echtsystem (nutzerseitig):** Server im Echtdaten-Modus starten → Log zeigt
  „[Sync] N Aufträge aktualisiert"; Board lädt danach sofort; über Nacht laufen gelassen → am
  Morgen frische Zahlen ohne Zutun.
