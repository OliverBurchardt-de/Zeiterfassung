# UI- und Fachreview: Zeiterfassung & Auftragsabwicklung

Stand: 22. Juni 2026  
Kontext: aktuelles M1-Mock-up ohne Backend, Desktop-Arbeitsplätze in der Kanzlei

## Kurzfazit

Das Mock-up ist fachlich bereits deutlich mehr als eine reine Design-Skizze. Die Grundstruktur aus Board, Planung, laufenden Buchungen, Controlling, Meine Zeiten, Freigaben und Verwaltung passt gut zum Kanzleiworkflow.

Die nächsten sinnvollen Schritte sind nicht primär weitere Screens, sondern produktionsnahe Regeln und Absicherungen:

- Rollen- und Berechtigungslogik
- Freigabe- und Eskalationsregeln
- Audit-Historie
- robuste DATEV-Sync- und Konfliktszenarien
- sauberes Zeitbuchungsmodell

Mobile- oder Touch-Optimierung ist für diese Phase nicht relevant, da die Anwendung für Desktop-Arbeitsplätze gedacht ist.

## 1. UI-Review für Desktop

### 1.1 Informationsdichte im Board

**Beobachtung:** Board, KPIs, Filter, rechte Übersichten und Karten-Badges zeigen sehr viele Informationen gleichzeitig.

**Empfehlung:** Eine klare Tagespriorisierung ergänzen, z. B.:

- Meine nächsten Aufgaben
- Heute kritisch
- Wartet auf mich
- Freigabe erforderlich

Das Board bleibt die Detailarbeitsfläche, aber der Einstieg sollte stärker auf Handlung statt nur Status ausgerichtet sein.

### 1.2 Hauptaktion pro Rolle sichtbarer machen

**Beobachtung:** Die wichtigsten Aktionen unterscheiden sich je Rolle, sind aber im UI noch verteilt.

**Mitarbeiter braucht vor allem:**

- Zeit buchen
- Checkliste abarbeiten
- Frage stellen oder beantworten
- Review Note als erledigt melden

**Partner braucht vor allem:**

- Zeit freigeben
- Umplanung freigeben oder zurückgeben
- Review Note freigeben oder zurück an Mitarbeiter geben
- neue Review Note anlegen

**Empfehlung:** Im Auftragsdetail rollenabhängige Primäraktionen deutlich hervorheben. Das Freigaben-Modul sollte als zentrales Partner-Cockpit etabliert werden.

### 1.3 Editierbare Felder klarer kennzeichnen

**Beobachtung:** Plandaten, Datumsfelder und Soll-Stunden wirken im Mock-up editierbar. Wenn diese Änderungen nicht wirklich gespeichert oder freigegeben werden, entsteht schnell falsche Erwartung.

**Empfehlung:**

- Felder entweder read-only darstellen, wenn DATEV führend ist.
- Oder einen klaren Prozess anzeigen: Änderung anfragen, speichern, Freigabe ausstehend, zurückgeschrieben nach DATEV.

### 1.4 Badges nach Handlungsbedarf gewichten

**Beobachtung:** Checkliste, Besonderheiten, offene Zeiten, Review Notes und Umplanung konkurrieren visuell um Aufmerksamkeit.

**Empfehlung:** Badges nach Dringlichkeit ordnen:

1. Blocker, z. B. Freigabe ausstehend, Checkliste verhindert Erledigt
2. offene Arbeit, z. B. Review Notes, offene Zeiten
3. Zusatzinformationen, z. B. Besonderheiten

## 2. Fachliche Lücken und Ergänzungen

### 2.1 Eskalation und Reminder

**Lücke:** Reminder sind vorgesehen, aber fachlich noch nicht ausreichend definiert.

**Zu klären:**

- Wann wird erinnert?
- Wer erhält die Erinnerung?
- Wie oft wird wiederholt?
- Wann eskaliert es an den Partner?
- Wann wird ein Reminder stummgeschaltet?
- Welcher Zustand erledigt den Reminder?

**Empfehlung:** Eine Reminder-Matrix definieren mit Auslöser, Frist, Empfänger, Wiederholung, Eskalation und Abschlussbedingung.

### 2.2 Statusübergänge und Workflow-Governance

**Lücke:** Im Mock-up können Status relativ frei geändert werden.

**Zu klären:**

- Wer darf welchen Status setzen?
- Welche Statussprünge sind erlaubt?
- Welche Rücksprünge sind erlaubt?
- Muss bei Rückgabe oder Rücksprung eine Begründung erfasst werden?
- Gibt es Pflichtfelder je Status?

**Empfehlung:** Statusregeln zentral definieren und sowohl im Frontend als auch später serverseitig erzwingen.

### 2.3 Zeitbuchungsmodell erweitern

**Lücke:** Zeitbuchungen hängen im Mock-up stark am Auftrag. Für Produktion braucht jede Buchung mehr fachliche Metadaten.

**Erforderliche Felder je Buchung:**

- Mitarbeiter
- Leistungsdatum
- Erfassungszeitpunkt
- Dauer
- Notiz
- Tätigkeit oder Aufwandsart
- Freigabestatus
- Freigeber
- Freigabezeitpunkt
- Änderungsverlauf

**Empfehlung:** Zeitbuchungen als eigene Entität in der App-Datenbank modellieren, nicht nur als eingebettete Order-Daten.

### 2.4 Vertretung und Teamarbeit

**Lücke:** Bearbeiter und Partner sind vorhanden, aber Vertretung, zweiter Bearbeiter und Übergabeprozesse fehlen noch.

**Typische Fälle:**

- Mitarbeiter ist abwesend.
- Partner delegiert Review an Vertretung.
- Auftrag wird vom Team übernommen.
- Bearbeiter wechselt während der Bearbeitung.

**Empfehlung:** Fachliche Felder und UI für Vertretung, Teamzuständigkeit und Übergabeentscheidung vorsehen.

### 2.5 DATEV-Sync und Konflikte

**Lücke:** Das UI zeigt noch nicht, was passiert, wenn DATEV und App gleichzeitig Änderungen enthalten.

**Beispiele:**

- DATEV ändert Bearbeiter oder geplantes Datum.
- App hat eine offene Umplanung.
- Rückschreibung nach DATEV schlägt fehl.
- Auftrag wurde in DATEV gelöscht oder abgeschlossen.

**Empfehlung:** Sync-Status pro Auftrag einführen:

- aktuell
- lokal geändert
- Rückschreibung offen
- Rückschreibung fehlgeschlagen
- in DATEV geändert
- Konflikt

Der Nutzer braucht klare Auflösungsschritte, keine stillen Fehler.

### 2.6 Audit-Trail

**Lücke:** Statuswechsel, Freigaben, Zeitänderungen und Umplanungen sind fachlich relevant, aber noch nicht als Historie sichtbar.

**Empfehlung:** Je Auftrag eine Historie ergänzen:

- wer
- wann
- was
- alter Wert
- neuer Wert
- Quelle: App oder DATEV
- ggf. Begründung

Für Freigaben, Umplanungen und Statuswechsel sollte das zwingend sein.

### 2.7 Berechtigungen

**Lücke:** Der Rollenumschalter ist für das Mock-up gut, produktiv braucht es harte Rechte.

**Empfehlung:** Rechte zentral definieren und später serverseitig durchsetzen:

- Mitarbeiter
- Partner
- Admin
- ggf. Vertreter

Wichtig: Frontend-Sperren allein reichen nicht.

## 3. Priorisierte Umsetzungsempfehlung

### Muss vor produktiver Pilotierung

- Rollen- und Rechtekonzept finalisieren.
- Statusübergänge mit erlaubten Pfaden und Pflichtbegründungen definieren.
- Audit-Historie für Status, Zeiten, Freigaben, Umplanungen und Notes ergänzen.
- Zeitbuchungsmodell um Mitarbeiter, Leistungsdatum, Freigeber und Änderungsverlauf erweitern.
- DATEV-Sync- und Fehlerzustände im UI sichtbar machen.

### Sollte für gute Alltagstauglichkeit ergänzt werden

- Rollenabhängige Primäraktionen im Detailmodal deutlicher hervorheben.
- Tages- bzw. Aufgabenfokus im Board schaffen.
- Reminder- und Eskalationsregeln fachlich entscheiden.
- Vertretungs- und Übergabeprozesse abbilden.
- Badges und Hinweise nach Handlungsbedarf priorisieren.

### Kann später folgen

- KI-Prüfung von Notizen bei Freigabe.
- Feinschliff bei Auftragsart-Konfiguration und Checklisten-Vorlagen.
- Erweiterte Controlling-Auswertungen über Planwerte, Fakturierung und Rückstände.

## 4. Konkrete Akzeptanzkriterien für den nächsten Entwicklungsschritt

1. Ein Partner kann in einem zentralen Cockpit alle offenen Freigaben sehen und bearbeiten: Zeiten, Umplanungen, Review Notes.
2. Jede Freigabe erzeugt einen nachvollziehbaren Historieneintrag mit Nutzer, Zeitpunkt und Entscheidung.
3. Ein Mitarbeiter sieht beim Öffnen eines Auftrags eindeutig die nächste sinnvolle Aktion.
4. Ein Auftrag kann nur über fachlich erlaubte Statuspfade weiterbewegt werden.
5. Bei einem fehlgeschlagenen DATEV-Writeback bleibt die App konsistent und zeigt dem Nutzer den offenen Fehlerzustand.
6. Zeitbuchungen enthalten alle für spätere Prüfung und DATEV-Rückspiegelung nötigen Metadaten.
7. Reminder werden nur auf Basis definierter fachlicher Regeln erzeugt und können nachvollziehbar erledigt oder eskaliert werden.

## 5. Ergänzende Code-Review-Hinweise aus der Vorprüfung

Diese Punkte stammen aus einer ersten Durchsicht des aktuellen Mock-up-Codes. Sie sind keine vollständige technische Abnahme, aber sinnvoll für den nächsten Entwicklungsschritt.

### 5.1 Umplanung aktualisiert nicht alle Plandaten

`approveUmplanung` setzt aktuell nur den neuen Monat, aber nicht konsequent `fristStart` und `fristEnde`. Dadurch können Detailansicht, Filter und Controlling widersprüchliche Daten zeigen.

**Empfehlung:** Bei Freigabe denselben Monats-/Datumsmechanismus verwenden wie bei `planOrder`.

### 5.2 Ungeplante Aufträge im Controlling

Ungeplante Aufträge haben leere Fristdaten. Ein einfacher Vergleich gegen den Stichtag kann sie fälschlich als überfällig behandeln.

**Empfehlung:** Überfälligkeit nur prüfen, wenn ein valides Fristende vorhanden ist.

### 5.3 Timer läuft nur bei geöffnetem Detailbereich zuverlässig

Der Timer-Tick hängt im Mock-up am gemounteten `TimePanel`. Wenn der Nutzer das Modal schließt oder die Ansicht wechselt, kann Zeit verloren gehen.

**Empfehlung:** Für Produktion Timer-Zustand robust modellieren: Startzeitpunkt speichern und laufende Dauer aus Zeitdifferenz berechnen.

### 5.4 Scheinbar editierbare Felder speichern nicht

Einige Felder wirken editierbar, haben aber keinen echten Speicherfluss.

**Empfehlung:** Read-only darstellen oder echte Änderungs-/Freigabelogik ergänzen.

## 6. Nicht relevant für diese Phase

Mobile- und Touch-Optimierung wird bewusst nicht betrachtet. Die Anwendung ist für Desktop-Arbeitsplätze in der Kanzlei gedacht. Responsive Anpassungen sollten nur soweit umgesetzt werden, dass übliche Desktop- und Laptop-Auflösungen sauber funktionieren.

## 7. Empfohlene nächste Abstimmung

Vor weiterer UI-Feinarbeit sollte ein kurzer Fachworkshop mit Kanzlei und Entwickler stattfinden. Ziel ist, die offenen Regeln für Status, Freigaben, Reminder, Vertretungen und DATEV-Konflikte verbindlich zu entscheiden.

Danach kann das Mock-up gezielt in Richtung produktiver M2-Architektur weiterentwickelt werden.
