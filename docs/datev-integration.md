# DATEV-Integration (Order Management v1)

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
| `art` / `artKey` | `ordertype` / `ordertype_group` |
| `fristStart` / `fristEnde` → `monat` | `planned_start` / `planned_end` (Monat aus Enddatum) |
| `soll` | `planned_hours` / `planned_hours_time_units` |
| `mandant` / `mandantNr` | `client_id` → Client Master Data API |
| `partner` | `order_partner_id` |
| `bearbeiter` | `order_responsible1_id` |
| `status` | `completion_status` (nur Teilmenge, s. u.) |

## Rückschreiben nach EO Comfort (PUT)
- **`PUT /orders/{orderid}`** (Body `order`): u. a.
  - `completion_status` — Auftragsstatus
  - `planned_start` / `planned_end` — **Umplanung** (nach Partner-Freigabe)
  - `planned_hours` / `planned_hours_time_units` — Planstunden
  - `order_responsible1_id` / `order_responsible2_id` / `order_partner_id` — Verantwortliche
- **`PUT /orders/{orderid}/suborders/{suborderid}`** (Body `suborders`): Stunden/Plandaten/Kosten
  auf Unterauftragsebene.

## Status-Mapping (10 App-Status ↔ DATEV `completion_status`)
Die 10 Kanban-Status (`av, ua, uv, bb, rf, rn, fg, am, fa, er`) sind App-intern (Status-Historie
in der eigenen DB). Zurückgeschrieben werden nur fachlich relevante Übergänge, z. B.:
| App-Status | DATEV `completion_status` |
|---|---|
| `bb` Bearbeitung begonnen | resumed / work started |
| (Unterbrechung) | interrupted |
| `er` Erledigt | done |

Die genaue Übergangstabelle (welcher App-Status welches Writeback auslöst) ist noch festzulegen.

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
