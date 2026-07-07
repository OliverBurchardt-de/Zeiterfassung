# DATEV-Integration (Order Management v1)

> Portal-/Onboarding-Ebene (Cloud vs. On-Premise, Registrierung, Sandbox, Auth-Wege,
> Gateway-Migration) siehe **`docs/datev-developer-portal.md`**. Dieses Dokument behandelt das
> konkrete Feld-/Status-Mapping und die Rückschreibung.

Quelle der Auftragsdaten ist die **On-Premise-API** *Order Management 1.4.9*
(`Order Management-1.4.9.json`), erreichbar über DATEVconnect unter
`http://localhost:58454/datev/api/order-management/v1/` mit **Basic Auth**.

## Lesen (GET)
- `/orders`, `/orders/{id}` — Aufträge (Filter: creation_year, ordertype, client_id,
  completion_status, billing_status, … ; **String-Werte in Hochkommata**, z. B.
  `filter=ordertype eq '9801'`). **Datenmenge (live, Juni 2026): ~7.500 Aufträge** an einer echten
  Kanzlei in **einer** Antwort → in Produktion **filtern** (Jahr/Status/Mandant) bzw. Paging prüfen,
  statt jedes Mal den Gesamtbestand zu ziehen.
- `/ordertypes` — Auftragsarten (Grundlage der Auftragsart-Konfig inkl. `ua`/`uv`)
- `/orders/{id}/monthlyvalues`, `/orders/{id}/orderstatework` — Ist-Werte / Stunden
- `/orders/{id}/costitems` — **buchbare Aufwandspositionen** des Auftrags (Plan-Seite, s. u.)
- `/orders/{id}/expensepostings` · `/orders/expensepostings` — **erfasste Aufwandsbuchungen** (Ist)
- `/costcenters`, `/selfclients` — Stammdaten
- **Mitarbeiter** (Namen + GUID) liegen **nicht** in Order Management (`/employeeswithgroup` lieferte
  am Live-System 0 Datensätze), sondern in **`master-data/v1/employees`** — Feld `id` = die
  `employee_id`, die für Buchungen benötigt wird (Filter z. B. `filter=contains(name,Burchardt)`)

## Feld-Mapping (App ← EO)
| App-Feld | EO-Feld |
|---|---|
| `auftragsNr` | `order_number` (+ `creation_year`) |
| `ordertype` (Identität) | `ordertype` (Kurz-Code, auch alphanumerisch) |
| `art` / `artKey` (projiziert) | abgeleitet aus `ordertype` + `ordertype_group` (s. u.) |
| `vj` (Veranlagungsjahr) | `assessment_year` (Integer, 4-stellig) |
| — (optional, Wirtschaftsjahr) | `fiscal_year` (Integer, 4-stellig; **nur befüllt, wenn in der EO-Konfiguration aktiviert**) |
| (Teilauftrags-Zeitraum) | `suborders.period_from` / `period_to` (echtes Von–Bis, z. B. USt-VA) |
| `fristStart` / `fristEnde` → `monat` | `planned_start` / `planned_end` (Monat aus Enddatum) |
| `soll` | `planned_hours` / `planned_hours_time_units` |
| `mandant` / `mandantNr` | `client_id` → Client Master Data API |
| `partner` | `order_partner_id` |
| `bearbeiter` | `order_responsible1_id` |
| `status` | `completion_status` (nur Teilmenge, s. u.) |
| (Vorgänger-Auftrag) | `order_number_predecessor` + `creation_year_predecessor` (Folgeauftrags-Kette) |

## Auftragsart-Zuordnung (Nummer → Typ → Farbe) — M2-Import

**Verifiziert am Live-System (25.06.2026, `GET /ordertypes`):** Ein Auftrag trägt `ordertype`
(Kurz-Code) und `ordertype_group` (Gruppen-Code). Die Katalog-API `/ordertypes` liefert je Eintrag:

| Feld | Bedeutung |
|---|---|
| `ordertypeId` | **stabile Ganzzahl** (eindeutiger Schlüssel — fürs Mapping nutzen) |
| `ordertype` | frei vergebener **Kurz-Code**, **nicht zwingend numerisch** (z. B. `106`, aber auch `PrüfStB`, `GrSt`, `TRANS`) |
| `ordertypeGroupId` / `ordertypeGroupName` | **Gruppe** (sprechend), z. B. „Finanzbuchhaltung", „Lohnbuchführung" |
| `active` | inaktive Arten ausblenden |
| `isinternal` | **interne** Arten (Verwaltung, Abwesenheit/Urlaub/Krankheit) → **nicht im Board** |

**Grundsatz (wichtig):** Der **`ordertype` ist die fachliche Identität** eines Auftrags und die einzige
**bebuchbare** Ebene. Die **`ordertype_group` ist nur eine Klassifizierung** (nicht bebuchbar). Die App
modelliert deshalb den **Ordertype am Auftrag** (`Order.ordertype`); die Gruppe dient ausschließlich als
**grober Farb-/Workflow-Bucket** (`ArtKey`) fürs Board und als Sammelfilter. Workflow-Regeln gehören
konzeptionell an den **Ordertype** — Musterfall sind die „laufenden" Arten, die ihre Gruppe überschreiben.

**Konsequenz:** Die App braucht eine **kanzlei-spezifische Zuordnung** (Admin-Bereich, M2), die jeden
**Ordertype** auf einen Board-Bucket + Workflow-Flags abbildet (Default je Gruppe, Override je Ordertype).
Jede Kanzlei hat **andere** Arten → die Liste wird beim Onboarding via `GET /ordertypes` eingelesen.

**Umgesetzt (M1):** Das fest verdrahtete Mock-Schema ist durch den **echten Live-Katalog** ersetzt — und
zwar auf **Ordertype-Ebene**: `src/lib/ordertypes.ts` enthält die volle Liste der aktiven, nicht-internen
Ordertypes (`ORDERTYPES`, mit Code/Name/Gruppe) plus den groben Bucket-Katalog (`ORDERTYPE_GROUPS`,
`ORDERTYPE_GROUP_TO_ART`, `LAUFENDE_ORDERTYPES`, `artKeyForOrdertype`, `ordertypeInfo`). Jeder Auftrag
trägt seinen `ordertype`-Code; `art` (Anzeigename) und `artKey` (Bucket) werden daraus **projiziert**
(wie es der DATEV-Adapter beim Import tut). Die Bucket-Übersicht (Gruppe → Board-Farbe), verifiziert am
Live-System (26.06.2026, `GET /ordertypes` → 10 Gruppen):

| group_id | DATEV-Gruppe | App-ArtKey | Board? | Besonderheit |
|---|---|---|---|---|
| 1 | Finanzbuchhaltung | `fibu` | ja | 616 „Mehraufwand FiBu" → `mehraufwand` (laufend) |
| 2 | Lohnbuchführung | `lohn` | ja | 615 „Mehraufwand Lohn" → `mehraufwand` (laufend) |
| 3 | Jahresabschluss/ betr. Steuern | `ja` | ja | enthält 613 „Prüfung von Steuerbescheiden" |
| 4 | Private Steuern | `est` | ja | ESt + Feststellung/Erbschaft/Einheitsbewertung |
| 5 | Steuerliche Beratung | `beratung` | ja | 601 „Laufende Steuerberatung" → `lfd_beratung` (laufend) |
| 11 | Wirtschaftliche Beratung | `wirtschaft` | ja | |
| 12 | Hausverwaltung | `hausverwaltung` | ja | 800 „Verwalterhonorar"/802 „NK-Abrechnungen" bleiben Board-Projekte |
| 13 | Vorbehaltsaufgaben | `vorbehalt` | ja | JAP/MaBV/§24 FinVermV (Prüfungen) |
| 9 | Verwaltung | — | nein | `isinternal=true` |
| 10 | Abwesenheit | — | nein | `isinternal=true` |

**Laufend** (Modul „Laufende Buchungen", nicht im Board, Pflicht-Notiz) ist **pro Ordertype**, nicht
pro Gruppe: 616/615 (Mehraufwand) → `mehraufwand`, 601 (Laufende Steuerberatung) → `lfd_beratung`.
Diese Ordertypes haben beim Mapping **Vorrang** vor ihrer Gruppe (`artKeyForOrdertype`).

**Workflow-Flags pro Ordertype** (am Ordertype-Katalog, nicht am Bucket — mit dem Auftraggeber
abgestimmt 26.06.2026). Felder in `Ordertype`: `teilauftraege` (`'monat'`=12 / `'quartal'`=4 Suborders),
`unterlagen` (Board-Spalten ua/uv), `besonderheiten` (Mandantenbesonderheiten-Button):

| Ordertype | Teilaufträge | Unterlagen | Besonderheiten |
|---|---|---|---|
| 106 Monatliche Finanzbuchführung | Monat | – | ✓ |
| 107 Vierteljährliche Buchführung | Quartal | – | ✓ |
| 108 Jahresbuchführung | – | – | ✓ |
| 310 Erfolgsreporting · 320 Immo-Reporting | Monat | – | – |
| 202 Lohnbuchführung | Monat | – | ✓ |
| 301 / 302 / 303 (Jahresabschluss/EÜR) | – | ✓ | ✓ |
| 501 Einkommensteuer · 502 Feststellung | – | – | ✓ |

Alle übrigen (Einrichtung 101/201, Beratungsverfahren 6xx, Prüfungen JAP/MaBV/FinVermV, Hausverwaltung
800/802, 504/505/507, Wirtschaftl. Beratung) tragen **kein** Flag. **FiBu hat bewusst keinen
Unterlagen-Prozess.** Durchgesetzt über `hasTeilauftraege`/`teilauftragRhythmus`/`hasUnterlagenProzess`/
`hasBesonderheiten` (jetzt ordertype-basiert, in `src/lib/art.ts`).

- `assessment_year` → Veranlagungsjahr (`vj`); Filter „Veranlagungsjahr".
- **Hinweis:** Eine eigene Gruppe „Umsatzsteuer" gibt es bei B&K **nicht** — USt-Themen laufen
  vermutlich innerhalb FiBu. Das Mock-Schema (mit separatem `ust`) ist also **nicht 1:1** übertragbar
  → bestätigt den Bedarf der konfigurierbaren Zuordnung.

## Mandantenbesonderheiten & Übernahme in Folgeaufträge
DATEV legt wiederkehrende Aufträge je Periode **neu** an (z. B. nach Abschluss JA 2025 entsteht
JA 2026). Konstant bleiben **`client_id`/Mandantennummer** und **Auftragsart** (`ordertype`),
es ändern sich Auftragsnummer sowie `assessment_year`/`fiscal_year`.
**Live-verifiziert (Juni 2026):** DATEV verlinkt den Vorgänger sogar **explizit** über
`order_number_predecessor` + `creation_year_predecessor` — die Folgeauftrags-Kette ist also direkt
auslesbar (keine Heuristik nötig). Das erlaubt eine **sichere** Übernahme periodenübergreifender
Daten (Besonderheiten, Checklisten-Anpassungen) vom unmittelbaren Vorgänger. Mandantenbesonderheiten
werden daher in der **eigenen App-DB** unter dem Schlüssel **`client_id + ordertype`**
(period-unabhängig) gespeichert. Jeder neu eingelesene Folgeauftrag mit gleichem Schlüssel löst
automatisch dieselben Besonderheiten auf — ein „Kopieren" beim Abschluss ist nicht nötig. Für
monatliche Teilaufträge (FiBu/Lohn) kann der Schlüssel bei Bedarf um die Monats-Dimension
erweitert werden (sonst gelten die Besonderheiten für alle Perioden des Auftrags gleichermaßen).

## Rückschreiben nach EO Comfort (PUT)
- **`PUT /orders/{orderid}`** (Body `order`): u. a.
  - `completion_status` — Auftragsstatus
  - `planned_start` / `planned_end` — **Umplanung** (nach Partner-Freigabe)
  - `planned_hours` / `planned_hours_time_units` — Planstunden
  - `order_responsible1_id` / `order_responsible2_id` / `order_partner_id` — Verantwortliche
- **`PUT /orders/{orderid}/suborders/{suborderid}`** (Body `suborders`): Stunden/Plandaten/Kosten
  auf Unterauftragsebene.

**Live-Erkenntnis (29.06.2026) — PUT verlangt ein vollständiges Objekt mit allen Pflichtfeldern:**
Ein PUT-Versuch an einem **internen** Auftrag (Kanzleiverwaltung) schlug mit **`EODC10009`**
(„Invalid field 'billingstatus' … either it is a required field or has the wrong format") fehl.
Ursache: `GET` liefert **leere/nicht zutreffende Felder gar nicht** mit (interne Aufträge haben z. B.
kein `billing_status`/`planned_hours`); `PUT` verlangt aber **alle Pflichtfelder**. Naives
„GET → ändern → ganzes Objekt zurück" scheitert daher bei sparsamen Aufträgen.
- **Pflichtfelder (PUT `order`, lt. Spec):** `id`, `order_id`, `creation_year`, `order_number`,
  `order_name`, `ordertype`, `assessment_year`, `fiscal_year`, `organization_id`, `establishment_id`,
  `functional_area_id`, `order_responsible1_id`, `client_id`, `completion_status`, **`billing_status`**.
- **Konsequenz für den Adapter:** Read-Modify-Write muss **alle Pflichtfelder garantieren** (fehlende
  aus Default/Sync ergänzen), bevor zurückgeschrieben wird. DATEV nennt im Fehler das beanstandete
  Feld (z. B. `billingstatus`).
- **Gültige Werte (Enums lt. Spec):**
  - `billing_status`: `open` · `partially invoiced` · `advance payment partially invoiced` ·
    `advance invoiced` · `invoiced`
  - `completion_status`: `created/planned` · `started` · `interrupted` · `work partially completed` ·
    `work completed` · `done`
  - `order_structure`: `total-order` · `consecutive-number` · `calendar-structure`
- **Bonus-Befund:** Neben `*_predecessor` gibt es auch **`creation_year_successor` /
  `order_number_successor`** — die Folgeauftrags-Kette ist also **in beide Richtungen** verlinkt.
- ✅ **PUT-Roundtrip live bestätigt (29.06.2026)** an einem eigens angelegten Test-Auftrag (vollständige
  Pflichtfelder): `planned_hours` 10→11→10, `planned_hours_time_units` 12000→13200→12000 — Schreiben
  **und** sauberes Zurücksetzen funktionieren.

## Aufträge anlegen/löschen — nicht über die API (führend: DATEV)
Die API kennt nur **GET/POST/PUT, kein DELETE**. Es gibt **kein `POST /orders`** und **kein
DELETE** — der einzige POST ist `…/expensepostings`. Aufträge werden also **ausschließlich in
DATEV** angelegt/gelöscht; das Tool **spiegelt** den Bestand (Sync/Pull) und schreibt nur
**Änderungen** an bestehenden Aufträgen zurück (PUT). Daraus folgt:
- **„Fehlenden Auftrag anfordern"** ist nur als **Workflow** umsetzbar (Mitarbeiter-Anforderung →
  Backoffice legt in DATEV EO **manuell** an → erscheint beim nächsten Sync). Kein Auto-Write.
- Bei in DATEV **gelöschten** Aufträgen: eigene Zusatzdaten (Zeiten/Notes/Checklisten)
  **archivieren statt hart löschen**. Mandantenbesonderheiten sind period-unabhängig und bleiben.

## Status-Mapping (10 App-Status ↔ DATEV `completion_status`)
Die 10 Kanban-Status (`av, ua, uv, bb, rf, rn, fg, am, fa, er`) sind App-intern (Status-Historie
in der eigenen DB). DATEV kennt auf **Gesamtauftrags**-Ebene das Feld `completion_status` mit
festen Werten (lesbar **und** per `PUT /orders/{id}` schreibbar):

`created/planned` · `started` · `interrupted` · `work completed` · `work partially completed` · `done` (= **Erledigt**)

Begleitend liefert/setzt DATEV automatisch Datumsfelder: `completion_date` (Datum Erledigt),
`interruption_date`, `resume_date`, `date_completion_status`.

**Writeback-Semantik laut Spec** (`PUT /orders/{id}` setzt Datum + Mitarbeiter automatisch aus
aktuellem Tag/Benutzer):
| App-Status | DATEV `completion_status` (PUT) |
|---|---|
| `bb` Bearbeitung begonnen | `started` bzw. `resumed` (nur aus `interrupted` möglich) |
| (Unterbrechung) | `interrupted` |
| `er` Erledigt | `done` (Erledigt-Datum wird automatisch gesetzt) |

→ **Antwort auf die Praxisfrage:** „Auftrag erledigt" kommt aus der API (`completion_status = done`)
und lässt sich zurückschreiben. Die genaue Zuordnung der übrigen App-Status ist noch festzulegen.

### Teilauftrag (Monat) — FIBU / Lohn
Monatliche Arbeit läuft auf **Suborder**-Ebene. Die Suborders kommen **eingebettet im Order-Objekt**
(`order.suborders[]` beim `GET /orders/{id}`) — verifiziert in `Order Management-1.4.9.json`
(definitions `order` → `suborders`). Relevante Felder je Teilauftrag:

| Feld | Bedeutung |
|---|---|
| `suborder_number` / `suborder_name` | Kennung des Teilauftrags |
| `period_from` / `period_to` | **Monatszeitraum** (echtes Von–Bis) |
| `planned_hours` / `planned_hours_time_units` | **Soll** |
| `total_hours` / `total_hours_not_invoiced` | **Ist** (gesamt / noch nicht abgerechnet) |
| `date_work_started` / **`date_work_completed`** | begonnen / **erledigt** (= `setSuborderDone`) |
| `date_invoiced` u. a. | Abrechnungsfelder (ergänzend `subordersstatebilling`) |

Schreibbar per `PUT /orders/{orderid}/suborders/{suborderid}` sind v. a.
`planned_hours_time_units`, `planned_start`, `planned_end` und **`date_work_completed`**. Es gibt
**kein** `completion_status`-Enum auf Teilauftragsebene — ein Monat wird über das Erledigt-**Datum**
fertig gemeldet, der Gesamtauftrag über `completion_status = done`. **Wichtig:** PUT überschreibt
Order bzw. Suborder **komplett** → immer erst GET, dann das geänderte Objekt zurückschreiben.

Der **Basis-Pfad** lt. Spec: `http://localhost:58454/datev/api/order-management/v1/`. Das Order-Objekt
trägt zudem `isinternal` (interne Art → nicht ins Board) sowie `completion_status` / `billing_status`
mit zugehörigen Datumsfeldern.

## Controlling — Abrechnungs-Pull (M2)
Die Controlling-Liste **„noch nicht abgerechnet"** wird **nicht** in der App gepflegt, sondern
**im Hintergrund per DATEV-Pull** ermittelt: Ein periodischer Job liest die Aufträge und meldet
diejenigen, die **nicht** den Abrechnungs-/Fakturierungs-Status („Fakturiert") tragen, auf denen
aber bereits **Buchungen** (erfasste Zeiten/Leistungen) liegen. Quelle des Status ist DATEV
(`billing_status` + `date_billing_status`; **live-verifiziert Juni 2026: befüllt, beobachtet
`partially invoiced`**); die
Buchungen kommen aus der eigenen Zeiterfassung. Im M1-Mock bildet `istNichtAbgerechnet` diese
Regel read-only ab (`!fakturiert && times.length > 0`).

## Aufwandsarten (Mehraufwand / Dumm gelaufen) & KI-Prüfung
- Auf der Mehraufwand-Karte (Modul „Laufende Buchungen") wird je Buchung eine **Aufwandsart**
  gewählt (Mehraufwand / Dumm gelaufen). Diese mappt auf eine **Aufwandsposition** (`cost_position`)
  in EO Comfort; Rückschreibung als **Aufwandsbuchung** (`expensepostings`, s. nächster Abschnitt).
  Mapping Aufwandsart → `cost_position` gegen die Live-Instanz festlegen (M2).
- **KI-Prüfung (V2, vorgesehen):** Bei der **Selbst-Freigabe durch den Mitarbeiter** wird die Notiz
  per API an eine KI/ein LLM gegeben (Kategorie/Rechtschreibung/Aussagekraft). Schnittstelle:
  `src/lib/ki.ts` (`pruefeNotizKI`), Hook an `store.releaseTime`. Definition/Anbindung erst in V2.

## Zeit-/Aufwandsbuchung über `expensepostings` — VERIFIZIERT (26.06.2026)
Anders als zunächst angenommen gibt es **doch** einen Schreib-Endpunkt für **einzelne**
Zeit-/Leistungsbuchungen. **Schreibtest am 26.06.2026 erfolgreich** (`HTTP 201`, Buchung in EO
sichtbar) am internen Kanzleiauftrag (ordertype `9801`, `order_id 9809`, suborder `38686`).

**Endpunkt (einziger POST der API):** `POST /orders/{orderid}/suborders/{suborderid}/expensepostings`
→ gebucht wird **immer am Teilauftrag** (suborder), nie am Gesamtauftrag.

**Pflichtfelder** (`#/definitions/expense_postings`, `required`):
- `employee_id` — DATEV-Mitarbeiter-GUID (aus `master-data/v1/employees`, Feld `id`)
- `work_date` — **Arbeitsdatum** (Format `26.06.2026 00:00:00`)
- `cost_position` — Aufwandsposition (Code, z. B. `906`)
- **+ Berechnungsfeld je Aufwandsart** (s. Tabelle)

**Aufwandsarten (`cost_type`) und erlaubte Felder:**
| `cost_type` | erlaubte/erforderliche Felder |
|---|---|
| `time-costs` (Zeit) | `time_units` **zusammen mit** `Start_time` (Einheit Stunden); ODER `number_of_days` (Einheit Tage) |
| `material-costs` | `number_of_units` (Menge) ODER `cost_amount` (Betrag) |
| `expenses-costs` | `number_of_units` ODER `cost_amount` |
| `external-costs` | `cost_amount` |

Für unsere Zeiterfassung relevant: **`time-costs`**.

**Stolpersteine (Spec + Live-Test):**
- **`time_units`: 1 Stunde = 1200 Einheiten** (4 h = 4800).
- **`id` beim POST NICHT senden** → sonst „key mismatch".
- **Buchung = Dauer OHNE `Start_time`** (verifiziert): Wird `Start_time` (Uhrzeit) mitgesendet,
  prüft DATEV auf Zeit-**Überschneidung** und lehnt mit **`EODC20127`** ab. B&K bucht nur Dauern
  (keine Zeitslots) → `Start_time` weglassen, nur `time_units`. (`Start_time` mit **großem S** ist
  die korrekte Schreibweise, falls doch benötigt.)
- **POST ist NICHT idempotent** (verifiziert): gleicher Body zweimal → **zwei** getrennte Buchungen
  (Server vergibt `id` neu, z. B. `…-30`/`…-31`). Der **Sync muss Dubletten verhindern**: erfolgreich
  übertragene Einträge sofort auf Status **`uebertragen`** setzen und nie erneut posten; zusätzlich
  einen **Idempotenz-Schlüssel** je Eintrag mitführen. **Korrektur/Löschen nur in EO Comfort** — die
  API hat **kein DELETE** für expensepostings.
- **`entry_date` nicht buchbar** (System-Stempel, von DATEV gesetzt; nur **tagesgenau**, `00:00:00`).
  Maßgeblich ist **`work_date`** — der Sync-Zeitpunkt ist egal (entkoppelter Batch-Sync möglich;
  Buchung läuft immer auf das Arbeitsdatum, unabhängig davon, wann übertragen wird).
- `cost_amount` nicht bei `time-costs`. Optional: `comment` (≤255), `isbillable`, `fee_position`.
- Query `automaticintegration=true` → Buchung wird direkt in den Auftrag integriert; fehlerhafte
  landen in der **ZMA-Massendatenerfassung**. Mit `deletemassdataonfailure=true` (nur zusammen mit
  `automaticintegration=true`) werden fehlerhafte Versuche automatisch verworfen.

Beispiel-Body (Zeitbuchung 4 h):
```json
{ "employee_id": "<GUID>", "work_date": "26.06.2026 00:00:00",
  "cost_position": "906", "time_units": 4800, "Start_time": "08:00:00",
  "comment": "...", "isbillable": false }
```

### Buchbare Positionen — `costitems` (Plan) vs. `expensepostings` (Ist)
`/orders/{id}/costitems` liefert die **geplanten** Aufwandspositionen des Auftrags (Plan-Seite,
**ohne** Buchungswerte). Verifizierte Felder je Zeile: `cost_position`, `cost_position_name`,
`cost_type`, `unit_description`, `accounting_allowed`, `suborder_id` — **kein Mitarbeiter-Feld**.

**Am Live-System belegte Eigenheit:** `costitems` enthält pro Position **eine Basis-Planzeile +
eine weitere Zeile je Mitarbeiter, der darauf gebucht hat** (Zeilen unterscheiden sich nur in `id`).
Beispiel 9801: Position `900` → 8 Zeilen = 1 Basis + 7 buchende Mitarbeiter; Position `905` (ohne
Buchung) → genau 1 Zeile. Der Mitarbeiter-Bezug steckt **nicht** in `costitems`, sondern in
`expensepostings`. Die EO-Ansicht „Zeiten" zeigt entsprechend `expensepostings`, aggregiert nach
`cost_position` + `employee_id`.

**App-Logik (M2):**
- **Auswahlliste „worauf buchbar?"** = `costitems` → `accounting_allowed = true` →
  **dedupliziert nach `cost_position`**. `accounting_allowed` ist **dynamisch** (hängt vom
  Auftrags-/Teilauftrags-**Status** ab) → live beim Buchen auswerten, nicht cachen.
- **Ist-Stunden je Mitarbeiter** = `expensepostings`, gruppiert nach `cost_position` + `employee_id`.
- **Kein zentraler Positions-Katalog** als Endpunkt: Die „Standardaufwandspositionen" aus EO sind
  nur **auftragsbezogen** über `costitems` lesbar (auch nicht in `master-data`). Fachlich korrekt —
  buchbar ist nur, was am jeweiligen Auftrag hinterlegt und `accounting_allowed` ist. Für einen
  firmenweiten Überblick (Admin/Config) eignet sich der globale `GET /orders/costitems`
  (Filter z. B. `cost_type eq ZEI`), dedupliziert nach `cost_position`.

### Konsequenz für Freigabe- & Sync-Workflow
Die detaillierte Zeiterfassung inkl. **Selbst-Freigabe durch den Mitarbeiter** lebt in der eigenen
App-DB (Status `erfasst → freigegeben → uebertragen`, Typ `TimeStatus`). **Keine Partner-Freigabe.**
Der Sync-Job schreibt **nur freigegebene** Einträge als `expensepostings` zurück (je Eintrag mit
seinem `work_date`) und setzt sie danach auf `uebertragen`. Stunden auf Auftrags-/Suborder-Ebene
(`planned_hours`, `total_hours`) bleiben die aggregierte Sicht; die Einzelbuchung erfolgt über
`expensepostings`.

## Weitere im Repo vorhandene Specs (Kontext, `docs/specs/`)
`Client Master Data-1.7.1.json` (Mandanten/Mitarbeiter), `Accounting-*.json`,
`accounting-clients-2.0.json`, `accounting_documents-*.json`, `accounting_dxso-jobs-*.json`,
`Diagnostics and Functional Tests-1.1.2.json` (DATEVconnect-Verfügbarkeit prüfen).
