# Ideen-Backlog

> Sammelstelle für Ideen, die während der Arbeit entstehen. Erfassen ≠ sofort bauen.
> Status je Idee: **Neu** (notiert) → **Abgestimmt** (Umfang/Zeitpunkt geklärt) → **Umgesetzt**.
> Einordnung: **M1** = klickbarer Mock (Look & Feel, Mock-Daten) · **M2** = echtes Backend/DATEV.

## In Umsetzung / als Nächstes
> M2-Fahrplan: **`docs/m2-plan.md`** (abgestimmt 27.06.2026: erst Plan, dann DATEV-Spike zuerst,
> Zeit-Sync im Spike final klären). Phase 0 (Mock-Workflows) ist abgeschlossen — s. „Umgesetzt".
> Nächster Schritt: **Phase 1 — DATEV-Spike** (on-prem; ich liefere Skript/Checkliste, werte aus).

## Offen — abgestimmt
_(leer)_

## Externer Code-Review (26.06.2026) — Bewertung & Status
> Quelle: `docs/reviews/2026-06-26-externer-codereview.md` (erstellt gegen den `main`-Stand).
> Legende: ✅ erledigt · 🟡 teilweise (Mock-Härtung jetzt, Rest M2) · ⏭ M2/Backend · 💤 offen.

### Bereits umgesetzt (M1)
- ✅ **P1.2 `approveUmplanung` setzt Fristdaten** — `monatBounds` in `store.ts` (Monat **und**
  `fristStart/fristEnde`), Umplanung danach `null`.
- ✅ **P1.3 `istUeberfaellig` gegen leere Fristen** — Guard `if (!o.fristEnde) return false;`
  (`selectors.ts`).
- ✅ **P1.4 „Heute erfasst" misst heute** — `heuteErfasst` filtert `t.datum === HEUTE`
  (`selectors.ts`); Umbenennung nicht nötig.
- ✅ **P3.1 Monatslogik zentral** — `DEMO_KALENDER` (eine Quelle in `mock/orders.ts`, aus `HEUTE`);
  Planung **und** Umplanung (OrderModal) nutzen sie.
- 🟡 **P1.1 Statuswechsel-Guard im Store** — Kernregeln jetzt auch im Store (`setStatus`):
  „Erledigt" nur bei vollständiger Checkliste, `ua`/`uv` nur mit Unterlagen-Prozess. **Rest M2:**
  vollständige Übergangsmatrix, Rollenrechte, Audit, serverseitige Durchsetzung.
- 🟡 **P1.5 Zeitbuchungs-Guard im Store** — `addManualTime` verwirft ungültige Dauer/Datum.
  **Rest M2:** Obergrenze, Pflicht-Notiz/Aufwandsart serverseitig, eindeutiger Erfasser (nicht nur
  Bearbeiter), keine Buchung auf archivierte DATEV-Aufträge.
- ✅ **P2.2 Testbasis** — Vitest eingeführt (`npm test`); Tests für `canComplete`, `istUeberfaellig`,
  `heuteErfasst`, `auslastungPct`, Monatslogik, `setStatus`-Guard, `approve/rejectUmplanung`,
  `addManualTime`. **Next:** Komponenten-/E2E-Tests (RTL/Playwright).
- ✅ **P2.3 CI** — `.github/workflows/ci.yml` (typecheck · lint · test · build).

### M2 / Backend — vor produktivem Einsatz (aus dem Review übernommen)
- ⏭ **P0.1 Backend + serverseitige Autorisierung** — eigener Login, serverseitige Rollen-/
  Rechteprüfung, Transaktionen, zentrale Persistenz, Audit-Log, DATEV-Adapter als abgeschottetes
  Modul. Keine fachlichen Daten produktiv im `localStorage`.
- ⏭ **P0.2 Rollen/Admin serverseitig** — Mock: Login setzt Rolle/Admin aus dem Nutzer und filtert
  die Sichtbarkeit (s. „Umgesetzt"), aber das ist **nicht verbindlich**. M2: Rollen/Rechte aus dem
  Backend, jede sicherheitsrelevante Aktion serverseitig autorisieren (Zeit-/Review-Freigaben,
  Nutzerverwaltung, Statuswechsel, DATEV-Writeback, Löschen/Archivieren), und der Server liefert
  von vornherein nur erlaubte Aufträge aus (nicht nur Frontend-Filter).
- ⏭ **P0.3 Echte Persistenz statt `localStorage`** — fachliche Daten nur serverseitig (Verschlüsselung,
  Backup, Berechtigung, Audit, Migrationen); lokal nur UI-State.
- ⏭ **P1.1/P1.5/P1.6 (vollständig) zentrale Domain-Validierung** — validierte Funktionen
  `changeOrderStatus` / `validateTimeEntry` / Note-Aktionen mit Actor-Kontext, Rollen, zulässigen
  Übergängen, Audit; Store/UI nur noch über diese Funktionen.
- ⏭ **P2.1 DATEV-Spike vor M2** — Testauftrag GET, Statuswechsel-PUT, `planned_start/end`-Writeback,
  Suborder `date_work_completed`, Konfliktverhalten (PUT überschreibt vollständig!), DATEVconnect-
  Benutzerrechte, Fehlerszenarien, Zeit-Rückschreibung final klären (API vs. Export-Fallback).
- ⏭ **P2.4 Attachment-Konzept** — max. Größe, erlaubte Typen, server-seitige MIME-/Extension-Prüfung,
  Virenscan/Quarantäne, Storage-Key statt freier URL, Berechtigung je Auftrag, Audit, Aufbewahrung/
  Löschung. **M1-Kleinfix offen:** Object-URLs im Frontend mit `URL.revokeObjectURL` freigeben.
- ⏭ **P2.5 Auftragsart-Konfiguration in DB** — Mapping DATEV-Nummer → ArtKey/Label/Farbe/Checkliste/
  Flags (Unterlagen, Pflicht-Notiz, laufend, Besonderheiten) statt Hardcode in `ordertypes.ts`/
  `art.ts`. (Keim ist bereits da: `ORDERTYPES` + `artKeyForOrdertype`.)
- ✅ **P3.2 Fonts lokal ausliefern** — Aleo wird jetzt lokal aus `public/fonts/aleo/` geladen
  (latin + latin-ext, variabel 400–700, kursiv 400); kein Google-Fonts-Aufruf mehr. Verifiziert:
  bei blockierten Google-Domains rendert Aleo weiterhin. (Aleo: SIL Open Font License.)
- 💤 **P3.3 Deployment-Trennung** — `vite host:true` ist Dev-Only; Produktiv über HTTPS/Reverse Proxy
  klar dokumentieren (`docs/architektur.md`).
- 💤 **P3.4 Farben entdoppeln** — Hex-Werte aus Komponenten konsequent über CSS-Variablen/zentrales
  Mapping; TS-Spiegel (`tokens.ts`) aus einer Quelle pflegen.

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
- **Umplanungs-Regeln JA/ESt (Mock, Phase 0.2)**: Erstplanung (Pool → Monat) ist frei; für
  Jahresabschluss (`ja`) und Einkommensteuer (`est`) ist **1× Umplanung pro Veranlagungsjahr** ohne
  Freigabe möglich (Zähler `umplanungenVerbraucht` am Auftrag, zurück in den Pool setzt ihn zurück),
  **jede weitere** erfordert die Partner-Freigabe. Alle übrigen Arten: jede Umplanung über Freigabe.
  Durchgesetzt zentral (`umplanungFreiMoeglich` in `selectors.ts`, Store-Action `umplanen`) in
  **OrderModal** (Button „Umplanen" vs. „Freigabe anfordern") **und** **Planung** (Drag & Drop eines
  bereits geplanten Auftrags löst bei aufgebrauchtem Kontingent direkt die Freigabe-Anfrage aus →
  Badge „→ Zielmonat"). Abgestimmt 27.06.2026: Kontingent pro VJ, Regel nur JA/ESt.
- **Auftrags-Anforderung (Mock, Phase 0.1)**: Knopf „Auftrag anfordern" im Board-Kopf öffnet ein
  Formular (Mandant, Auftragsart, VJ, Zeitraum, Notiz) + Liste „Meine Anforderungen" mit Status.
  **Backoffice-Inbox** in der Verwaltung (Admin): offene Anforderungen „als angelegt melden" oder mit
  Grund „ablehnen". Status `angefordert → angelegt | abgelehnt`. Mitarbeiter sieht nur eigene,
  Admin alle (`sichtbareAnforderungen`). Hintergrund: DATEV kennt kein `POST /orders` → reiner
  Workflow; in M2 löst „angefordert" eine E-Mail aus, „angelegt" kommt per Sync. Abgestimmt
  27.06.2026: Knopf im Board-Kopf, Inbox in der Verwaltung.
- **Mock-Login + Auftrags-Sichtbarkeit (Preview)**: Login-Screen (E-Mail/Passwort +
  Demo-Schnellanmeldung); Rolle/Admin-Recht kommen aus dem angemeldeten Nutzer; Logout in der
  Top-Bar. **Sichtbarkeit „nur eigene zugewiesene"**: Mitarbeiter sehen nur Aufträge, bei denen sie
  Bearbeiter sind (Board, KPIs, rechte Spalte, Controlling, Freigaben, Planung), Partner ihre
  verantworteten Mandate, Admin alles (`sichtbareAuftraege`/`useVisibleOrders`). **Wichtig:** reine
  Frontend-Preview, NICHT sicher — verbindliche Authentifizierung/Autorisierung serverseitig in M2
  (siehe P0.1/P0.2). Verifiziert: S. Wolf 13 vs. O. Burchardt 21 Aufträge.
- **Checklisten-Verwaltung pro Auftragsart**: in „Verwaltung" zwei Buttons —
  **Checklisten verwalten** (je Ordertype: Punkte hinzufügen/bearbeiten/entfernen, neu von Grund
  auf, „auf Vorlage zurücksetzen") und **Aus Excel/CSV importieren** (Spalte A = Auftragsart-Code,
  Spalte B = Punkt; Modus ersetzen/ergänzen, Vorschau, unbekannte Codes übersprungen, Beispiel-
  Vorlage als Download). Parser (SheetJS) wird per Dynamic-Import nur bei Bedarf geladen.
  Persistiert im Store. M2: DATEV-Import nutzt diese Vorlagen je Auftragsart.
- **Board-Karte schlank**: Checkliste/Besonderheiten nicht mehr auf der Karte, nur noch im
  Auftrags-Detail (beim Bearbeiten); Karten-Flyout entfernt.
- **Teilzeit-Kapazität**: Nutzer haben `tagessoll` (Std./Tag) **und** `arbeitstageProWoche`
  (pflegbar in der Verwaltung); die Planung rechnet Monatskapazität = Tagessoll × Arbeitstage
  (Mo–Fr) × (Tage/Woche ÷ 5). Feiertage/Urlaub erst M2 (DATEV `employeecapacities`).
- **Board-Spalten ua/uv** benennen jetzt die zutreffende Auftragsart („nur JA") statt „nur best.
  Auftragsarten" — abgeleitet aus dem Ordertype-Katalog (`unterlagenArtLabels`).
- **Freigaben-Cockpit** (Partner): Zeiten/Umplanungen/Review-Notes an einer Stelle freigeben.
- **Meine Zeiten**: persönliche Zeitübersicht (offen/freigegeben/ohne Zeit).
- **Teilaufträge FiBu & Lohn**: Monatsraster (12 Monate) im Auftrags-Detail, je Monat
  Soll/Ist + „erledigt" (DATEV `date_work_completed`). Zeitbuchung je Monat = M2.
- **Kleinpolituren**: Browser-Persistenz (localStorage) + funktionierende Top-Bar-Suche.
  (Logo-Asset bleibt offen.)
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
- **Schnellbuchung im Auftrag**: Button „Laufende Zeit buchen" im Auftrags-Detail bucht — ohne
  Screenwechsel — auf den passenden laufenden Auftrag desselben Mandanten (1:1 über Mandantennr +
  Auftragsart aufgelöst); Kategorie Steuerberatung / Mehraufwand / Dumm gelaufen, Pflicht-Notiz.
- Mandantenbesonderheiten (Schlüssel Mandant + Auftragsart, period-unabhängig).
- Checkliste je Auftragsart in eigenem Panel; „Erledigt" gesperrt bis vollständig.
- Modul „Verwaltung" (Nutzerverwaltung als Mock, Admin-Zusatzrecht).
