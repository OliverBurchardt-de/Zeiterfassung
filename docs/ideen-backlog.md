# Ideen-Backlog

> Sammelstelle für Ideen, die während der Arbeit entstehen. Erfassen ≠ sofort bauen.
> Status je Idee: **Neu** (notiert) → **Abgestimmt** (Umfang/Zeitpunkt geklärt) → **Umgesetzt**.
> Einordnung: **M1** = klickbarer Mock (Look & Feel, Mock-Daten) · **M2** = echtes Backend/DATEV.

## In Umsetzung / als Nächstes
_(leer — wird beim Start eines Punktes hierher verschoben)_

## Offen — abgestimmt
_(leer)_

## Offen — neu (noch zu besprechen)

### KI-Prüfung der Buchungs-Notiz bei Freigabe — V2 (technisch vorgesehen)
Bei der **Freigabe** einer laufenden Buchung wird die Notiz per API an eine KI gegeben, die prüft:
passt die **Kategorie** (Mehraufwand vs. Dumm gelaufen), stimmt die **Rechtschreibung**, ist die
**Beschreibung ausreichend**. Saubere Definition (Prompt/Schwellen/Workflow bei „nicht ok") = Aufwand → **V2**.
- **Jetzt vorgesehen:** Schnittstelle `pruefeNotizKI` + Typen in `src/lib/ki.ts`; Aufruf-Hook an der
  Zeit-Freigabe (`store.approveTime`) als Kommentar markiert. Noch nicht aktiv.

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

### Umplanungs-Regeln für JA & Einkommensteuer — als Nächstes
Aufbauend auf dem Planungs-Modul (Pool + Kalender, Drag & Drop):
- **Erstplanung** (Auftrag aus dem Pool in einen Monat): frei durch den Mitarbeiter.
- Jeder Auftrag **Jahresabschluss / Einkommensteuer** darf **einmal im Jahr umgeplant** werden.
- **Nach** der Erstplanung erfordert **jede Umplanung die Freigabe** des Partners (wie die bereits
  vorhandene Umplanung im Auftrags-Detail → Badge „Freigabe ausstehend").
- Offen: Zähler „1× Umplanung/Jahr" — pro Vj? Wer hebt die Sperre auf (Partner)? Verhalten bei
  Drag & Drop eines bereits geplanten Auftrags (direkt Freigabe-Anfrage statt sofort verschieben).

### Sync-Architektur DATEV ↔ Tool (führend: DATEV) — M2
- Aufträge werden **in DATEV angelegt/gelöscht**; das Tool spiegelt den Bestand (Pull).
- Eigene Zusatzdaten (Zeiten, Notes, Checklisten) am Auftrag: bei DATEV-Löschung **archivieren
  statt hart löschen** (Historie/Nachvollziehbarkeit). Mandantenbesonderheiten sind period-
  unabhängig (Mandant + Auftragsart) und überstehen Auftragswechsel ohnehin.

## Umgesetzt
- **Planungstool** — Modul „Planung": oben Pool **noch nicht geplanter** Aufträge, unten
  **Kalender** mit Monatskapazität (Tagessoll × Arbeitstage); per **Drag & Drop** Auftrag in einen
  Monat ziehen → setzt Anfangs-/Enddatum (`planOrder`), zurück in den Pool hebt die Planung auf.
  Monatskarte zeigt Kapazität, geplante Stunden, Füllbalken (Ampel) und ⚠ bei Überbuchung.
  Offen/Next: Umplanungs-Regeln (s. o.); M2: Kapazität aus DATEV `employeecapacities`
  (Urlaub/Teilzeit/Feiertage) statt fixem Tagessoll.
- **Controlling (Auftrags-Überwachung)** — Modul „Controlling": überfällige Aufträge
  (`fristEnde < Stichtag`, nicht erledigt), Planwert-Ausschöpfung (≥80 % / >100 %), noch nicht
  abgerechnet = ohne DATEV-Status „Fakturiert", aber mit Buchungen (read-only, in M2 per
  Hintergrund-DATEV-Pull). Stichtag im Mock `HEUTE` (= 2025-03-20).
- Veranlagungsjahr lesen + Filter; Farben je Auftragsart.
- Zeitbuchung mit Notiz (Pflicht bei Beratung/Mehraufwand).
- Modul „Laufende Buchungen" (Beratung/Mehraufwand, ohne Status-Flow); je Buchung auf der
  Mehraufwand-Karte Auswahl **Aufwandsart** (Mehraufwand / Dumm gelaufen → EO-Aufwandsarten).
- Mandantenbesonderheiten (Schlüssel Mandant + Auftragsart, period-unabhängig).
- Checkliste je Auftragsart in eigenem Panel; „Erledigt" gesperrt bis vollständig.
- Modul „Verwaltung" (Nutzerverwaltung als Mock, Admin-Zusatzrecht).
