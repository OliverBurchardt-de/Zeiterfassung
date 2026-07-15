# ABC-Analyse (Mandanten-Rentabilität) — Konzept

> Status: **vorgesehen, nicht in Version 1.** Dieses Papier hält fest, dass die DATEV-API
> alle nötigen Zahlen liefert, wie sie zusammengesetzt werden und wo das Modul später in der
> App andockt. Quelle der Feldnamen: `docs/specs/Order Management-1.4.9.json` (DATEVconnect
> Order Management v1.4.9), geprüft am 11.07.2026.

## Ziel

Mandanten nach wirtschaftlicher Bedeutung sortieren (A/B/C): **Wie viel Umsatz** bringt ein
Mandant, **wie viel Kosten** verursacht er, was bleibt als **Deckungsbeitrag**? Reine
**Lese-Auswertung** — es wird nichts nach DATEV zurückgeschrieben.

## Kernbefund: Die API liefert Umsatz UND Kosten fertig aufbereitet

### 1) `/orders/monthlyvalues` — die zentrale Auswertungsquelle

DATEV führt je **Auftrag × Monat** eine fertige Werte-Zeile, inklusive `client_id` (Mandant).
Damit lässt sich alles je Mandant/Jahr aggregieren:

| API-Feld | Bedeutung | Verwendung in der ABC-Analyse |
|---|---|---|
| `total_turnover` | Umsatz gesamt | **Umsatz** (Sortier-Größe) |
| `fees` / `expenses` | Honorar- / Auslagenumsatz | Aufriss des Umsatzes |
| `total_hours` | Ist-Stunden | Stundenbasis |
| `time_costs` | Personalkosten (DATEV-Kostensätze) | **Kosten** (Weg 1) |
| `material_costs`, `expenses_costs`, `external_costs` | Sach-/Auslagen-/Fremdkosten | Kosten-Aufriss |
| `…_not_invoiced` (Stunden/Kosten) | noch nicht abgerechnet | **WIP-Sicht** (Bonus) |
| `month`, `year`, `client_id`, `ordertype` | Dimensionen | Filter/Gruppierung |

### 2) `/invoices` — real fakturierter Umsatz

Tatsächlich gestellte Rechnungen je Mandant: `net_amount`, `gross_amount`, `fees`,
`expenses`, `date_of_invoice`, `client_id`; `sub_invoices[]` verweist auf `order_id`.
Nutzen: Abgleich „bewerteter Umsatz" (monthlyvalues) vs. „fakturierter Umsatz" (invoices).

### 3) Kosten alternativ über die eigene Stundenbewertung (Weg 2)

Unabhängig von den DATEV-Kostensätzen geht der bereits angedachte eigene Weg:
`/orders/{id}/expensepostings` liefert jede Zeitbuchung mit `employee_id`, `work_date`,
`time_units` (1 Stunde = 1200 Units, s. `docs/datev-connect-handoff.md`) und `isbillable`.
**Ist-Stunden × kanzleieigener Stundensatz je Mitarbeiter = Kosten.** Die eigene
Satz-Tabelle (Mitarbeiter → €/h) wäre Admin-Pflege in unserer App (eigene DB, nicht DATEV).

Ergänzend liefert `/employeescostrate` die in DATEV hinterlegten Kostensätze je Mitarbeiter
(`cost_rate_1..9`, Gültigkeitszeiträume) und `/chargerates` die Verrechnungssätze — beide
Wege bleiben also offen, Weg 1 und Weg 2 sind gegeneinander plausibilisierbar.

## Die ABC-Logik (fachlich)

1. Je Mandant aggregieren (Zeitraum wählbar, Default: laufendes Jahr):
   Umsatz = Σ `total_turnover`; Kosten = Σ `time_costs` + Sach-/Fremdkosten
   (oder Weg 2); Deckungsbeitrag = Umsatz − Kosten; DB-Quote = DB / Umsatz.
2. Mandanten nach Umsatz absteigend sortieren, kumulierten Umsatzanteil bilden.
3. Klassen nach Pareto (Standard, später admin-konfigurierbar):
   **A** = bis 80 % kumulierter Umsatz, **B** = bis 95 %, **C** = Rest.
4. Interessant wird die Kreuz-Sicht: Umsatzklasse × DB-Quote — z. B. „A-Mandant mit
   negativem Deckungsbeitrag" ist der eigentliche Handlungsfall.

## Wo das Modul in der App andockt

Gleiche Bauart wie die bestehende **Controlling**-Sicht (reine Auswertung, kein Workflow):

- **Server:** DATEV-Port (`server/src/domain/ports.ts`) bekommt zwei Lesemethoden
  `getMonthlyValues(filter)` und `getInvoices(filter)`; der HTTP-Adapter ruft die o. g.
  Endpunkte, der Mock-Adapter liefert Demodaten. Eine Domain-Aktion aggregiert je Mandant
  (Zeitraum als Parameter) und ein Endpunkt `GET /api/abc` liefert die fertige Tabelle.
  Sichtbarkeit: **nur Partner/Admin** (Umsatz-/Kostendaten sind Führungsinformation).
- **Frontend:** neue Sicht „ABC-Analyse" neben Controlling — Tabelle (Mandant, Umsatz,
  Kosten, DB, Klasse) + einfache Visualisierung; Filter Zeitraum/Auftragsart.
- **Eigene DB (nur für Weg 2):** Tabelle Stundensätze je Mitarbeiter (Admin-Pflege).

## Vor dem Bau zu klären (beim Echtdaten-Test mitprüfen)

- [ ] **Berechtigungen:** Antworten `/orders/monthlyvalues` und `/invoices` mit echten Daten
      oder mit `403`? (Ggf. braucht der Zugriff zusätzliche Rechte „Auswertungen"/EO comfort —
      dann beim ASP-Partner für den technischen Benutzer beantragen.)
- [ ] **Datenqualität:** Sind `time_costs` gefüllt (setzt gepflegte DATEV-Kostensätze
      voraus)? Falls nein → Weg 2 als führender Kostenweg.
- [ ] **Mengengerüst:** monthlyvalues über alle Aufträge/Jahre kann groß sein → mit
      Jahresfilter abrufen (analog `DATEV_ORDERS_FILTER`).

Schneller Vorab-Test (PowerShell, lesend — Adresse/Anmeldung wie in
`docs/echtdaten-lokal-testen.md`):

```powershell
curl.exe -k --ntlm -u "DOMAIN\benutzer" "https://<interne-IP>:58452/datev/api/order-management/v1/orders/monthlyvalues?filter=year eq 2026" -H "Accept: application/json; charset=utf-8"
curl.exe -k --ntlm -u "DOMAIN\benutzer" "https://<interne-IP>:58452/datev/api/order-management/v1/invoices?filter=accounting_year eq 2026" -H "Accept: application/json; charset=utf-8"
```

Kommt JSON mit Zahlen zurück, ist der Weg frei; kommt `403`, ist es eine Rechtefrage an den
ASP-Partner — kein technisches Hindernis.
