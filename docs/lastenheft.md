# Lastenheft (Arbeitsstand)

## Ziel
Eine App, in der Mitarbeiter der Kanzlei **Zeiterfassung**, **Auftragsplanung** und die
**Auftragsabwicklung** (Kanban-Board) an einer Stelle erledigen. Auftragsdaten aus DATEV EO,
Rückschreibung nach EO Comfort.

## Rollen
- **Mitarbeiter** (Sachbearbeiter) — Standard-Sicht.
- **Partner** (mandatsverantwortlich) — Review/Freigaben.

## Flow
1. **Arbeitsvorrat:** Mitarbeiter sehen alle Aufträge und filtern (Zuständigkeit, geplanter
   Monat, **Veranlagungsjahr**, Auftragsart, Schnellfilter) → persönlicher Arbeitsvorrat.
2. **Umplanung:** Auftrag in anderen Monat verschieben → Freigabe-Anfrage an den Partner
   (Badge „Freigabe ausstehend"), bis der Partner freigibt.
3. **Abwicklung:** Aufträge wandern durch 10 Status-Buckets (Kanban, Planner-Stil) — per
   Drag & Drop oder Status-Leiste.
4. **Zeiterfassung am Auftrag:** Live-Timer oder manuell; erfasste Zeit ist zunächst „nicht
   freigegeben" und wird vom Partner freigegeben. Jede Buchung kann eine **Notiz** tragen;
   bei den Auftragsarten *Laufende Steuerberatung* und *Mehraufwand* ist die Notiz **Pflicht**.
4b. **Laufende Buchungen (eigenes Modul):** *Laufende Steuerberatung* und *Mehraufwand / Dumm
   gelaufen* haben keinen Status-Ablauf und erscheinen nicht im Kanban-Board. Sie sind dauerhafte
   Buchungs-Container je Mandant; im Modul „Laufende Buchungen" wird nur Zeit (mit Pflicht-Notiz)
   gebucht und vom Partner freigegeben.
5. **Reminder:** Aufträge ohne erfasste Zeit oder mit nicht freigegebenen Zeiten werden in festen
   Intervallen per E-Mail an den Bearbeiter gemeldet (Backend-Job, M2).
6. **Review:** Aufträge im Status „Reviewfähig" werden vom Partner geprüft; Review Notes anlegen,
   Mitarbeiter bearbeitet und meldet erledigt, Partner gibt frei.
6b. **Mandantenbesonderheiten:** je Mandant + Auftragsart (Button auf der Karte für FiBu, Lohn,
   Jahresabschluss, Einkommensteuer; nicht direkt auf der Karte angezeigt). Gespeichert unter dem
   Schlüssel `Mandantennummer + Auftragsart` (period-unabhängig) → werden automatisch von den
   Aufträgen der Folgeperioden (Jahr/Monat) wiederverwendet, auch wenn DATEV den Auftrag mit neuer
   Auftragsnummer und neuem VJ/WJ neu anlegt. Persistenz in der eigenen App-DB (M2).
7. **Checkliste je Auftragsart:** Jede Auftragsart hat eine eigene Aufgaben-Checkliste
   (Vorlage in `src/lib/checklists.ts`). Ein Auftrag kann erst auf **„Erledigt"** gesetzt werden
   (Status-Leiste **und** Drag & Drop), wenn alle Checklistenpunkte abgehakt sind. Konkrete
   Inhalte je Art folgen in M2; im Mock ist FiBu beispielhaft befüllt (Personalaufwand abgestimmt,
   USt gebucht, AfA gebucht, BWA übermittelt), JA generisch, übrige leer.

## Status-Buckets (Reihenfolge)
`av` Arbeitsvorrat · `ua` Unterlagen anfordern* · `uv` Unterlagen vollständig* · `bb` Bearbeitung
begonnen · `rf` Reviewfähig · `rn` Review Notes · `fg` Freigegeben · `am` An Mandant übermittelt ·
`fa` Beim FA eingereicht · `er` Erledigt.
*Nur für Auftragsarten mit Unterlagen-Prozess.

## Review-Notes- & Fragen-Regeln (Thread)
- `kind`: `frage` (Mitarbeiter) / `review` (Partner). Anlegen: beide (Typ nach Rolle).
- **Frage** (`offen ↔ erledigt`): **ohne Partner-Freigabe**. Mitarbeiter „Als erledigt markieren"
  bzw. „Wieder aufnehmen" oder Rückfrage (Kommentar). Löschen: Mitarbeiter.
- **Review** (`offen → erledigt → freigegeben`): „Als erledigt melden" (Mitarbeiter); „Freigeben",
  „Zurück an Mitarbeiter" (erledigt→offen), „Wieder öffnen" (freigegeben→offen), „Löschen": Partner.
- Bearbeiten/Kommentieren/**Dateien anhängen**: beide. Anhänge (`attachments`) an jeder Note/Frage;
  im Mock als Object-URL, im Backend (M2) echte Datei-Ablage.

## Offene Punkte (Feinschliff)
- Exakte Status↔`completion_status`-Übergänge für das DATEV-Writeback.
- Zeit-Rückschreibung gegen Live-DATEVconnect verifizieren (Endpunkt vs. Export-Fallback) —
  siehe `docs/datev-integration.md`.
- Reminder-Intervalle, Empfänger, Eskalation an den Partner.
- Auftragsart-Konfiguration: welche Arten benötigen `ua`/`uv` (aktuell Mock: Jahresabschluss,
  Finanzbuchhaltung — `ARTEN_MIT_UNTERLAGEN` in `src/lib/art.ts`).
- Auftragsart-Zuordnung (M2-Import): DATEV liefert die Art als **Nummer** → hochzuladende Liste
  Nummer→Typ→Kürzel→**Farbe** (ersetzt das feste 5er-Schema `ART`). Siehe `docs/datev-integration.md`.
  Veranlagungsjahr kommt aus `assessment_year`.
- Soll Umplanung zusätzlich per Drag & Drop möglich sein? (aktuell bewusst freigabebasiert)
- Offizielles Logo-Asset (SVG/transparentes PNG) statt `assets/logo.jpg`.
- Suchfeld in der Top-Bar mit Funktion hinterlegen.
- Module „Meine Zeiten" und „Freigaben" ausgestalten (aktuell Platzhalter).
