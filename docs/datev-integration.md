# DATEV-Integration (Order Management v1)

> Portal-/Onboarding-Ebene (Cloud vs. On-Premise, Registrierung, Sandbox, Auth-Wege,
> Gateway-Migration) siehe **`docs/datev-developer-portal.md`**. Dieses Dokument behandelt das
> konkrete Feld-/Status-Mapping und die Rückschreibung.

Quelle der Auftragsdaten ist die **On-Premise-API** *Order Management 1.4.9*
(`Order Management-1.4.9.json`), erreichbar über DATEVconnect unter
`http://localhost:58454/datev/api/order-management/v1/` mit **Basic Auth**.

## Lesen (GET)
- `/orders`, `/orders/{id}` — Aufträge (mit Filtern: creation_year, ordertype, client_id,
  completion_status, billing_status, …)
- `/ordertypes` — Auftragsarten (Grundlage der Auftragsart-Konfig inkl. `ua`/`uv`)
- `/orders/{id}/monthlyvalues`, `/orders/{id}/orderstatework` — Ist-Werte / Stunden
- `/employees*`, `/costcenters`, `/selfclients` — Stammdaten

## Feld-Mapping (App ← EO)
| App-Feld | EO-Feld |
|---|---|
| `auftragsNr` | `order_number` (+ `creation_year`) |
| `art` / `artKey` | `ordertype` / `ordertype_group` (kommt als **Nummer**, s. u.) |
| `vj` (Veranlagungsjahr) | `assessment_year` (Integer, 4-stellig) |
| — (optional, Wirtschaftsjahr) | `fiscal_year` (Integer, 4-stellig; **nur befüllt, wenn in der EO-Konfiguration aktiviert**) |
| (Teilauftrags-Zeitraum) | `suborders.period_from` / `period_to` (echtes Von–Bis, z. B. USt-VA) |
| `fristStart` / `fristEnde` → `monat` | `planned_start` / `planned_end` (Monat aus Enddatum) |
| `soll` | `planned_hours` / `planned_hours_time_units` |
| `mandant` / `mandantNr` | `client_id` → Client Master Data API |
| `partner` | `order_partner_id` |
| `bearbeiter` | `order_responsible1_id` |
| `status` | `completion_status` (nur Teilmenge, s. u.) |

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

**Konsequenz:** Die App braucht eine **kanzlei-spezifische Zuordnung** (Admin-Bereich, M2), die die
DATEV-Arten auf App-Typen abbildet — am robustesten **auf Gruppen-Ebene** (`ordertypeGroupId`),
mit optionalen Einzel-Overrides je `ordertypeId`. Das ersetzt das im M1-Mock fest verdrahtete
Schema (`ART` in `src/lib/art.ts`). Jede Kanzlei hat **andere** Arten → die Liste muss beim
Onboarding eingelesen und gemappt werden.

**Vorschlag Gruppen → App-Typ** (aus dem Live-Katalog Burchardt & Kollegen abgeleitet):

| DATEV-Gruppe | App-Typ | Besonderheit |
|---|---|---|
| Finanzbuchhaltung | `fibu` | Teilaufträge (monatlich); „Mehraufwand FiBu" = laufend |
| Lohnbuchführung | `lohn` | Teilaufträge (monatlich); „Mehraufwand Lohn" = laufend |
| Jahresabschluss/ betr. Steuern | `ja` | enthält „Prüfung von Steuerbescheiden" |
| Private Steuern | `est` | Einkommensteuer + weitere private |
| Steuerliche Beratung | `beratung` | „Laufende Steuerberatung" = laufend |
| Wirtschaftliche Beratung / Hausverwaltung / Vorbehaltsaufgaben | (neu/Sonstiges) | im Mock-Schema bisher nicht abgebildet |
| Verwaltung, Abwesenheit | — | `isinternal=true` → **nicht im Board** |

- `assessment_year` → Veranlagungsjahr (`vj`); Filter „Veranlagungsjahr".
- Welche Arten den Unterlagen-Prozess (`ua`/`uv`) brauchen, ist Teil derselben Konfiguration.
- **Hinweis:** Eine eigene Gruppe „Umsatzsteuer" gibt es bei B&K **nicht** — USt-Themen laufen
  vermutlich innerhalb FiBu. Das Mock-Schema (mit separatem `ust`) ist also **nicht 1:1** übertragbar
  → bestätigt den Bedarf der konfigurierbaren Zuordnung.

## Mandantenbesonderheiten & Übernahme in Folgeaufträge
DATEV legt wiederkehrende Aufträge je Periode **neu** an (z. B. nach Abschluss JA 2025 entsteht
JA 2026). Konstant bleiben **`client_id`/Mandantennummer** und **Auftragsart** (`ordertype`),
es ändern sich Auftragsnummer sowie `assessment_year`/`fiscal_year`. Mandantenbesonderheiten
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
(`billing_status` bzw. das entsprechende Faktura-Feld — gegen die Live-Instanz verifizieren); die
Buchungen kommen aus der eigenen Zeiterfassung. Im M1-Mock bildet `istNichtAbgerechnet` diese
Regel read-only ab (`!fakturiert && times.length > 0`).

## Aufwandsarten (Mehraufwand / Dumm gelaufen) & KI-Prüfung
- Auf der Mehraufwand-Karte (Modul „Laufende Buchungen") wird je Buchung eine **Aufwandsart**
  gewählt (Mehraufwand / Dumm gelaufen). Diese mappt auf die **Aufwandsarten in EO Comfort**;
  Rückschreibung als **Aufwandsbuchung** über `POST /orders/{id}/suborders/{sid}/expensepostings`
  (einziger POST der API). Mapping Aufwandsart → EO-ID gegen die Live-Instanz festlegen (M2).
- **KI-Prüfung (V2, vorgesehen):** Bei Freigabe wird die Notiz per API an eine KI/ein LLM gegeben
  (Kategorie/Rechtschreibung/Aussagekraft). Schnittstelle: `src/lib/ki.ts` (`pruefeNotizKI`),
  Hook an `store.approveTime`. Definition/Anbindung erst in V2.

## Offener Punkt — Zeit-Rückschreibung
Für **einzelne** Tages-/Mitarbeiter-Zeiteinträge gibt es in dieser API keinen Schreib-Endpunkt;
Stunden werden auf Auftrags-/Unterauftragsebene geführt (`planned_hours`, Suborder-Stunden). Die
detaillierte Zeiterfassung inkl. Freigabe-Workflow lebt daher in der eigenen DB; **freigegebene
Summen** werden nach DATEV zurückgespiegelt. Vor der Backend-Umsetzung gegen die Live-DATEVconnect-
Instanz verifizieren, ob/wie eine feinere Leistungsbuchung möglich ist (sonst Export/Import-Fallback).

## Weitere im Repo vorhandene Specs (Kontext)
`Client Master Data-1.7.1.json` (Mandanten/Mitarbeiter), `Accounting-*.json`,
`accounting-clients-2.0.json`, `accounting_documents-*.json`, `accounting_dxso-jobs-*.json`,
`Diagnostics and Functional Tests-1.1.2.json` (DATEVconnect-Verfügbarkeit prüfen).
