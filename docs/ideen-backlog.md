# Ideen-Backlog

> Sammelstelle für Ideen, die während der Arbeit entstehen. Erfassen ≠ sofort bauen.
> Status je Idee: **Neu** (notiert) → **Abgestimmt** (Umfang/Zeitpunkt geklärt) → **Umgesetzt**.
> Einordnung: **M1** = klickbarer Mock (Look & Feel, Mock-Daten) · **M2** = echtes Backend/DATEV.

## In Umsetzung / als Nächstes
_(leer — wird beim Start eines Punktes hierher verschoben)_

## Offen — abgestimmt
_(leer)_

## Offen — neu (noch zu besprechen)

### Auftrags-Anforderung durch Mitarbeiter (Workflow) — M2
Mitarbeiter können einen **fehlenden Auftrag anfordern**; das **Backoffice** legt ihn an und
schreibt ihn nach DATEV.
- **API-Befund (geprüft, `Order Management-1.4.9.json`):** Die Schnittstelle kennt nur
  **GET/POST/PUT, kein DELETE**. Es gibt **kein `POST /orders`** (Anlegen) und **kein DELETE**
  (Löschen); der einzige POST ist `…/expensepostings`. → **Aufträge können nicht automatisch nach
  DATEV geschrieben oder dort gelöscht werden.**
- **Konsequenz:** Funktion nur als **Workflow** umsetzbar, nicht als API-Write:
  Mitarbeiter stellt Anforderung (Mandant, Auftragsart, VJ/Zeitraum, Notiz) → Aufgabe/Inbox fürs
  Backoffice → Backoffice legt den Auftrag **manuell in DATEV EO** an → beim nächsten **Sync**
  erscheint er im Tool. Wahrt „DATEV ist führend".
- **Workflow (abgestimmt):**
  1. Mitarbeiter erstellt eine Anforderung (Mandant, Auftragsart, VJ/Zeitraum, Notiz).
  2. **Auslöser:** automatische **E-Mail ans Backoffice** (Backend-Job, wie der Reminder).
  3. Backoffice legt den Auftrag **in DATEV EO** an.
  4. Backoffice **meldet im Workflow „angelegt" zurück** → Anforderung wechselt den Status und der
     Mitarbeiter bekommt Rückmeldung; der Auftrag kommt per Sync ins Tool.
- **Status-Modell der Anforderung:** `angefordert → angelegt` (optional `abgelehnt` mit Grund).
- **M1-mockbar:** Anforderungs-Formular + Backoffice-Inbox mit „als angelegt melden" (UI/States).
  **M2:** echte E-Mail (Backend) und die DATEV-Anlage selbst.
- **Offen:** Wo läuft die Inbox (eigenes Modul/Reiter „Anforderungen")? E-Mail-Empfänger/-Text;
  soll der Mitarbeiter zusätzlich eine Benachrichtigung im Tool sehen?

### Sync-Architektur DATEV ↔ Tool (führend: DATEV) — M2
- Aufträge werden **in DATEV angelegt/gelöscht**; das Tool spiegelt den Bestand (Pull).
- Eigene Zusatzdaten (Zeiten, Notes, Checklisten) am Auftrag: bei DATEV-Löschung **archivieren
  statt hart löschen** (Historie/Nachvollziehbarkeit). Mandantenbesonderheiten sind period-
  unabhängig (Mandant + Auftragsart) und überstehen Auftragswechsel ohnehin.

## Umgesetzt
- **Planungstool (Auslastung & Monatsplanung)** — Modul „Planung": je Mitarbeiter/Monat
  geplante Stunden vs. Kapazität (Tagessoll × Arbeitstage), Auslastungsbalken mit Ampel,
  Auftrag einem Kollegen zuordnen. Offen für M2: Urlaub/Teilzeit, Feiertage, echte Kapazität.
- **Controlling (Auftrags-Überwachung)** — Modul „Controlling": überfällige Aufträge
  (`fristEnde < Stichtag`, nicht erledigt), Planwert-Ausschöpfung (≥80 % / >100 %), noch nicht
  abgerechnet = ohne DATEV-Status „Fakturiert", aber mit Buchungen (read-only, in M2 per
  Hintergrund-DATEV-Pull). Stichtag im Mock `HEUTE` (= 2025-03-20).
- Veranlagungsjahr lesen + Filter; Farben je Auftragsart.
- Zeitbuchung mit Notiz (Pflicht bei Beratung/Mehraufwand).
- Modul „Laufende Buchungen" (Beratung/Mehraufwand, ohne Status-Flow).
- Mandantenbesonderheiten (Schlüssel Mandant + Auftragsart, period-unabhängig).
- Checkliste je Auftragsart in eigenem Panel; „Erledigt" gesperrt bis vollständig.
- Modul „Verwaltung" (Nutzerverwaltung als Mock, Admin-Zusatzrecht).
