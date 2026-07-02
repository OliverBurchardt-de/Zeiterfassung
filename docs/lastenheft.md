# Lastenheft (Arbeitsstand)

## Ziel
Eine App, in der Mitarbeiter der Kanzlei **Zeiterfassung**, **Auftragsplanung** und die
**Auftragsabwicklung** (Kanban-Board) an einer Stelle erledigen. Auftragsdaten aus DATEV EO,
Rückschreibung nach EO Comfort.

## Rollen
- **Mitarbeiter** (Sachbearbeiter) — Standard-Sicht.
- **Partner** (mandatsverantwortlich) — Review/Freigaben.
- **Admin-Recht** (Zusatz-Recht, keine eigene Rolle) — Nutzerverwaltung + App-Konfiguration;
  kombinierbar mit Mitarbeiter oder Partner (z. B. „Partner + Admin").

## Nutzerverwaltung (Modul „Verwaltung", abgestimmt — Umsetzung M2)
Eigener Reiter, **nur für Admins sichtbar**. Mitarbeiterliste mit Detail-/Bearbeiten-Dialog.
- **Nutzer-Felder:** Name · Kürzel/Initialen · E-Mail (Login + Reminder) · Rolle
  (Mitarbeiter/Partner) · Admin-Recht (ja/nein) · Status (aktiv/deaktiviert) ·
  DATEV-Mitarbeiter-ID (Mapping zu `order_responsible*`/`order_partner_id`) · Tagessoll (Std.) ·
  *(M2)* Passwort/Einladung, letzter Login.
- **Aktionen:** Anlegen · Bearbeiten · Deaktivieren/Reaktivieren (**kein Löschen** — Nutzer sind in
  Aufträgen/Zeiten/Notizen referenziert; Deaktivieren erhält die Historie, blendet aus Auswahllisten
  aus). *(M2)* Passwort zurücksetzen / Einladung senden.
- **Rechte:** rollenbasiert (feste Rollen genügen). Mitarbeiter: Aufträge/Zeiten/Fragen/Checkliste/
  Besonderheiten. Partner: zusätzlich Freigaben (Review/Zeiten/Umplanung). Admin-Recht:
  Nutzerverwaltung + Konfiguration (Auftragsart-Mapping, Checklisten-Vorlagen, Reminder).
- **Nutzerquelle:** in der App gepflegt; je Nutzer wird die DATEV-Mitarbeiter-ID hinterlegt
  (optional Vorbefüllung aus DATEV beim Setup). Login/Rollen/Rechte liegen in der eigenen App-DB.

## Module (Navigation)
Board · **Planung** · Laufende Buchungen · **Controlling** · Meine Zeiten · Freigaben ·
Verwaltung *(nur mit Admin-Recht)*.

- **Planung:** oben der Pool **nicht geplanter** Aufträge, unten ein **Kalender** mit
  Monatskapazität (Tagessoll × Arbeitstage). Per **Drag & Drop** wird ein Auftrag in einen Monat
  gezogen → im Hintergrund werden Anfangs-/Enddatum gesetzt; Zurückziehen in den Pool hebt die
  Planung auf. Monatskarte zeigt Kapazität, geplante Stunden, Füllbalken (Ampel) und ⚠ bei
  Überbuchung. **Geplant (als Nächstes):** JA/Einkommensteuer 1× Umplanung/Jahr; **nach**
  Erstplanung jede Umplanung mit Partner-Freigabe. M2: echte Kapazität aus DATEV
  (`employeecapacities`).
- **Controlling:** Auftragsüberwachung für Partner/Leitung zum Stichtag — **überfällig**
  (`fristEnde < Stichtag` & nicht erledigt), **Planwert** erreicht/überschritten (erfasst ÷ Soll
  ≥ 80 % bzw. > 100 %), **noch nicht abgerechnet** = Auftrag **ohne DATEV-Status „Fakturiert"**,
  auf dem bereits **Buchungen** (erfasste Zeiten/Leistungen) liegen. Diese Liste wird **im
  Hintergrund per DATEV-Pull** ermittelt (M2) — read-only, **keine manuelle Pflege** in der App.
  Stichtag im Mock `HEUTE`; in Produktion das Tagesdatum.

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
   gebucht und vom Partner freigegeben. Auf der Mehraufwand-Karte wird je Buchung die
   **Aufwandsart** (Mehraufwand / Dumm gelaufen → EO-Aufwandsarten) gewählt.
4c. **Schnellbuchung im Auftrag:** Aus dem Auftrags-Detail kann laufende Zeit direkt gebucht werden
   („Laufende Zeit buchen") — ohne Screenwechsel; das Tool bucht auf den passenden laufenden Auftrag
   desselben Mandanten (1:1 über Mandantennr + Auftragsart). Bei Freigabe ist eine **KI-Prüfung der
   Notiz** technisch vorgesehen (Kategorie/Rechtschreibung/Aussagekraft) — Umsetzung V2.
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
   (Status-Leiste **und** Drag & Drop), wenn alle Checklistenpunkte abgehakt sind. Bedienung in
   einem eigenen Panel (Button „Checkliste" neben „Besonderheiten" auf Karte und im Detail). Konkrete
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
- ~~Offizielles Logo-Asset (SVG/transparentes PNG) statt `assets/logo.jpg`.~~ ✅ erledigt:
  `public/assets/logo.svg` (Wortmarke in Markenfarben), in TopBar + Login eingebunden.
- Teilaufträge (FiBu/Lohn): Zeitbuchung **je Monat** (aktuell nur „erledigt"-Status + Anzeige);
  Suborder-Rückschreibung via DATEV (`date_work_completed`, Suborder-Stunden) — M2.

## Module „Freigaben" & „Meine Zeiten" (umgesetzt)
- **Freigaben** (Partner-Cockpit): alle offenen Freigaben an einer Stelle — Zeiten
  (`approveTime`), Umplanungen (`approveUmplanung`), Review-Notes (`setNoteState`). Aktionen nur
  in Partner-Rolle aktiv.
- **Meine Zeiten**: persönliche Übersicht des Bearbeiters — nicht freigegebene / freigegebene
  Buchungen und eigene Aufträge ohne erfasste Zeit (Reminder-Grundlage).
- **Teilaufträge (FiBu/Lohn):** im Auftrags-Detail ein Monatsraster (12 Monate, Suborder-Ebene);
  je Monat Soll/Ist und „erledigt" (Analogon DATEV `date_work_completed`).
