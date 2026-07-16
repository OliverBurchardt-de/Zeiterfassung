# Konzept: Zeiterfassungs-Board + Auftragsart-Behandlung

> Status: **abgestimmt (Vision), Umsetzung geplant.** Grundlage: Live-Test der Echtdaten am
> 15.07.2026 + Auftragsart-Durchsprache (Excel) + Vorbild **memtime.com** und die bestehende
> **Ingentis-Kanzleisuite**. Dieses Papier hält die Entscheidungen fest, bevor gebaut wird.

## 1. Auftragsart-Behandlung (die saubere Datenbasis)

Jede DATEV-Auftragsart (`ordertype`) bekommt ein **Verhalten**. Das ersetzt die bisher rein
gruppenbasierte Einordnung durch eine **pro-Ordertype**-Konfiguration (admin-editierbar, M2).

| Verhalten | Bedeutung | Im Planungs-Board? | Zeit buchbar? |
|---|---|---|---|
| **planbar** | wird auf Monate geplant (Kernprozess) | **ja** | ja |
| **laufend** | läuft im Hintergrund mit (Mehraufwand/laufende Beratung) — nur Zeit + Pflicht-Notiz | nein | ja |
| **sonstige** | aktive Mandatsarbeit, aber nicht planbar (Projekt-/Einzelfälle) | nein | **ja** |
| **intern** | kanzleiintern (Urlaub, EDV, Verwaltung) | nein | ja (interne Zeit) |
| **inaktiv** | in DATEV deaktiviert — ignorieren | nein | nein |

**Wichtig (Entscheidung 15.07.2026):** Auch **sonstige** Aufträge müssen Mitarbeiter **bebuchen**
können (sonst fehlen Zeiten) — nur eben **nicht im Planungs-Board**, sondern über das
Zeiterfassungs-Board (Abschnitt 2). Zeit wird von dort nach DATEV zurückgebucht.

### Einordnung je Ordertype (Stand 15.07.2026)

**planbar (Board):** 106 Monatliche FiBu · 107 Vierteljährliche Buchführung · 108 Jahresbuchführung ·
310 Erfolgsreporting · 320 Immo-Reporting · 202 Lohnbuchführung · 301 JA/Betr. StE · 302 EÜR ·
303 JA und betr. StE · 501 ESt · 502 Feststellung · 504 Erbschaft-/Schenkungsteuer ·
505 Einheitsbewertung · 800 Laufendes Verwalterhonorar · 802 NK-Abrechnungen · FinVermV · MaBV · JAP

**laufend (Hintergrund):** 601 Laufende Steuerberatung · 615 Mehraufwand Lohn · 616 Mehraufwand FiBu

**sonstige (buchbar, nicht im Board):** 101 Einrichtung Buchführung · 201 Einrichtung Lohn ·
613 Prüfung von Steuerbescheiden · 507 Vor-/Nachlauf Private Steuern · 603 Anträge · 605 Rechtsbehelfe ·
606 Vermögensstatus · 607 Steuerliche Außenprüfung · 608 BUSTRA/Selbstanzeige · 609 Steuerstraf ·
610 Finanzgericht · 611 Revision BFH · 612 Beschwerde BFH · 617 Umwandlung · SAR · 701 Betriebswirt.
Beratung · TRANS · Corona

**intern:** 9801 Kanzleiverwaltung · 9802 Internes Rechnungswesen · 9804 EDV · 9806 Fortbildung ·
9807 Fremdarbeiten · 9901 Urlaub · 9903 Krankheit · Gleitzeit

**Grenzfall (offen, architektonisch vorsehen):** **614 Begleitung Außenprüfung DRV** — vorerst
*sonstige*; die Konfiguration muss erlauben, es später auf **planbar** zu setzen ODER als
**Mehraufwand im Lohn-Kontext** (laufend) zu behandeln. Da die Einordnung pro-Ordertype ist, ist
das ein Ein-Zeilen-Wechsel.

## 2. Zeiterfassungs-Board (neu, memtime-Stil)

**Problem:** Das Planungs-Board plant Aufträge auf Monate — es beantwortet aber nicht die Frage
des Mitarbeiters am Tagesende: *„Habe ich meinen Tag vollständig erfasst? Wo sind Lücken?"*

**Lösung:** eine **eigene Kachel „Zeiterfassung"** neben dem Planungs-Board — eine **grafische
Tages-Timeline** (Kalender), in der der Mitarbeiter seine Zeit sichtbar auf Aufträge verteilt:

- **Tages-Timeline** mit Stundenraster; erfasste Einträge als farbige Blöcke (Auftragsart-Farbe).
- **Lücken sichtbar:** unbelegte Zeit im Raster fällt sofort auf → „Tag voll?" auf einen Blick.
- **Mandant → Aufträge:** der Mitarbeiter wählt einen Mandanten, sieht **alle seine Aufträge**
  (planbar, laufend UND sonstige) und zieht sie **per Drag & Drop** in die Timeline.
- **Click & Drag** zum Anlegen eines Zeitblocks (Start/Ende), danach Auftrag + Pflicht-/Notiz
  zuweisen (analog memtime: Block ziehen → Projekt wählen → Kommentar → fertig).
- **Stoppuhr** (prominenter Timer im Board): Mitarbeiter startet die Uhr, arbeitet, stoppt —
  der entstandene Zeitblock erscheint in der Timeline und wird per Zuweisung/Drag auf den
  Auftrag gebucht. Technisch ist das der bestehende Live-Timer (M1) — hier bekommt er seine
  tagesorientierte Oberfläche.
- **Buchung nach DATEV:** die hier erfassten Zeiten laufen durch dieselbe freigeben→sync-Kette
  wie heute (auch für *sonstige* Aufträge).
- Die bestehende Zeiterfassung am Auftrag (im Planungs-Board) **bleibt** — das Zeiterfassungs-Board
  ist die zusätzliche, tagesorientierte Sicht.

**Ziel:** vollständige, lückenlose Tageserfassung mit minimaler Reibung — der Mitarbeiter „malt"
seinen Tag statt Formulare auszufüllen.

**Offen / kommt noch:** UX-Vorbilder aus der **Ingentis-Kanzleisuite** (Mandant-Auswahl →
Auftragsliste → Drag & Drop in grafische Übersicht) — Screenshots folgen, danach Feinentwurf.

## 3. Später (Version 3/4): Automatische Tätigkeitserfassung — PARKIERT

memtimes Kernidee: der Rechner **erfasst passiv und lokal**, woran gearbeitet wurde (Programme,
Dokumente, Dateien, Browser-Tabs, Termine) und legt das als **Erinnerungshilfe**-Zeitstrahl an;
der Mitarbeiter zieht diese erkannten Blöcke dann auf Aufträge. **Datenschutz:** die Aktivitätsdaten
bleiben lokal auf dem Gerät, werden nicht hochgeladen — der Nutzer entscheidet, was er übernimmt.

**Bewusst NICHT jetzt** (Aufwand + Datenschutz-/Betriebsrat-Klärung nötig). Als **V3/V4-Idee
vorgemerkt**, damit das Datenmodell der Zeiterfassung (Abschnitt 2) so gebaut wird, dass ein
„Vorschlag aus Aktivität → in Zeitblock übernehmen" später ohne Umbau andockbar ist.

## 4. Einordnung in die Roadmap

1. ✅ **Umgesetzt (15.07.2026):** Auftragsart-Konfiguration (Abschnitt 1) ins Projekt gegossen
   (`verhaltenFor` in `src/lib/ordertypes.ts`) + Planungs-Board/KPIs/Filter/Planung/Controlling
   auf `planbar` gefiltert; `sonstige` bebuchbar im Modul „Buchungen" (Abschnitt „Sonstige
   Aufträge" mit Suche). E2E-Suite: `tools/e2e/e2e-verhalten.mjs`.
   Ebenfalls ✅ (gleicher Tag): **Mandanten-Klarnamen** am Board (Client-Master-Data-Lookup,
   gecacht), **Teilaufträge** via `expand=suborders` — Karte zeigt **nur den nächsten offenen**
   Teilauftrag; Monatsfilter chronologisch + nur nach vorn; Buchungen-Suche über Mandant/
   Mandantennr./Auftrag. E2E: `tools/e2e/e2e-teilauftrag.mjs`.
2. **Danach:** Zeiterfassungs-Board (Abschnitt 2) als eigenes Feature entwerfen und bauen
   (nach den Ingentis-Vorbildern).
3. **V3/V4:** automatische Tätigkeitserfassung (Abschnitt 3).
