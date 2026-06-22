# Ideen-Backlog

> Sammelstelle für Ideen, die während der Arbeit entstehen. Erfassen ≠ sofort bauen.
> Status je Idee: **Neu** (notiert) → **Abgestimmt** (Umfang/Zeitpunkt geklärt) → **Umgesetzt**.
> Einordnung: **M1** = klickbarer Mock (Look & Feel, Mock-Daten) · **M2** = echtes Backend/DATEV.

## In Umsetzung / als Nächstes
_(leer — wird beim Start eines Punktes hierher verschoben)_

## Offen — abgestimmt
_(leer)_

## Offen — neu (noch zu besprechen)
_(leer)_

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
