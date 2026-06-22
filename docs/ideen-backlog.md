# Ideen-Backlog

> Sammelstelle für Ideen, die während der Arbeit entstehen. Erfassen ≠ sofort bauen.
> Status je Idee: **Neu** (notiert) → **Abgestimmt** (Umfang/Zeitpunkt geklärt) → **Umgesetzt**.
> Einordnung: **M1** = klickbarer Mock (Look & Feel, Mock-Daten) · **M2** = echtes Backend/DATEV.

## In Umsetzung / als Nächstes
_(leer — wird beim Start eines Punktes hierher verschoben)_

## Offen — abgestimmt
_(leer)_

## Offen — neu (noch zu besprechen)

### Planungstool (Auslastung & Monatsplanung) — M1-Mock möglich
Mitarbeiter sehen ihre **Auslastung** und planen, welche Aufträge sie im Monat bearbeiten.
- **Auslastung je Mitarbeiter & Monat:** geplante Soll-Stunden der zugewiesenen Aufträge vs.
  verfügbare Kapazität. Kapazität ableitbar aus `tagessoll` (Nutzer) × Arbeitstage im Monat.
- **Planen:** Auftrag einem Monat / sich selbst zuordnen; Über-/Unterlast sichtbar (Ampel/Balken).
- **Datenbasis:** vorhanden — `soll`, `monat`, `bearbeiter`/`bearbeiterId`, `tagessoll`.
  Ergänzen evtl.: Kapazität pro Monat (Urlaub/Teilzeit), Feiertage/Arbeitstage.
- **Bezug:** überschneidet sich mit „Umplanung" (Monat ändern → Partner-Freigabe).

### Controlling (Auftrags-Überwachung) — M1-Mock möglich
Auswertungs-Sicht für Partner/Leitung.
- **Überfällig:** `fristEnde < heute` und Status ≠ `er` (Erledigt).
- **Planwert erreicht/überschritten:** erfasste Stunden ≥ `soll` (Schwellen z. B. ≥80 %, ≥100 %).
- **Noch nicht abgerechnet:** Aufträge erledigt, aber nicht fakturiert.
  - **Ergänzen nötig:** Feld `abgerechnet` (ja/nein) bzw. Rechnungsstatus am Auftrag.
- **Datenbasis:** weitgehend vorhanden (`fristEnde`, `status`, `soll`, `times`); nur
  Abrechnungs-Status fehlt.

## Umgesetzt
- Veranlagungsjahr lesen + Filter; Farben je Auftragsart.
- Zeitbuchung mit Notiz (Pflicht bei Beratung/Mehraufwand).
- Modul „Laufende Buchungen" (Beratung/Mehraufwand, ohne Status-Flow).
- Mandantenbesonderheiten (Schlüssel Mandant + Auftragsart, period-unabhängig).
- Checkliste je Auftragsart in eigenem Panel; „Erledigt" gesperrt bis vollständig.
- Modul „Verwaltung" (Nutzerverwaltung als Mock, Admin-Zusatzrecht).
