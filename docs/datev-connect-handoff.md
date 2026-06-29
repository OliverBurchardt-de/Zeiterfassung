# DATEVconnect — Übergabe-Dokument (projektunabhängig)

> **Zweck:** Diese Datei fasst **eigenständig** zusammen, wie DATEVconnect (On-Premise,
> „Order Management" u. a.) angesprochen wird — **Verbindung, Authentifizierung, Lesen,
> Zurückschreiben, Buchen, Fallstricke**. Alles hier wurde an einer **echten DATEVasp-Instanz
> verifiziert** (Juni 2026). Sie ist so geschrieben, dass ein **anderes Projekt** sie direkt
> übernehmen kann, **ohne erneut testen** zu müssen.
>
> **Geltungsbereich:** DATEV im **DATEVasp**-Betrieb (gehostetes Rechenzentrum). Für klassische
> LAN-Installationen gilt dasselbe technisch, nur ist `localhost` dort der Kanzleirechner.
>
> **Was dieses Dokument NICHT enthält:** keine Zugangsdaten, keine Mitarbeiter-GUIDs/SIDs,
> keine Passwörter. Diese gehören nie ins Repo — sie kommen zur Laufzeit aus der Umgebung.

---

## 0. Das Wichtigste in 60 Sekunden

- DATEVconnect ist eine **lokale Schnittstelle**: ein Dienst, der **nur auf dem Server, auf dem
  die DATEV-Programme laufen**, unter `http://localhost:58454` (HTTP) bzw. `:58452` (HTTPS)
  antwortet.
- Im **DATEVasp**-Betrieb liegt dieser Server im **DATEV-Rechenzentrum (Nürnberg)**. `localhost`
  ist daher **nur auf dem gehosteten ASP-Desktop/-Server** erreichbar — **nicht** aus dem
  Kanzleinetz oder der Cloud. Eine Anwendung, die DATEVconnect nutzen will, muss **innerhalb der
  ASP-Umgebung gehostet** werden (organisatorische Frage an den DATEV-/ASP-Partner; keine
  Code-Frage).
- **Basis-URL:** `http://localhost:58454/datev/api` → dahinter die Domains
  (`order-management/v1`, `master-data/v1`, `diagnostics/v1`, `iam/v1`, …).
- **Auth:** entweder **Windows-SSO** (kein Passwort, wenn der Aufruf unter dem angemeldeten
  DATEV-Windows-Benutzer läuft — z. B. Browser/PowerShell auf dem ASP-Server) **oder**
  **Basic Auth** (Benutzer:Passwort — der Weg für einen unbeaufsichtigten Server-Adapter).
- **Pflicht-Header bei JEDEM Call:** `Accept: application/json; charset=utf-8` — sonst **406**.
- **Lesen** geht im Browser (GET). **Schreiben** (PUT/POST) braucht PowerShell/curl/Postman/Code.
- **PUT überschreibt das Objekt komplett** → immer **GET → ändern → PUT** (read-modify-write).
- Die API hat **kein DELETE** und **kein `POST /orders`**. Aufträge werden ausschließlich in DATEV
  angelegt/gelöscht; eine App **spiegelt** (Pull) und schreibt nur **Änderungen** zurück.

---

## 1. Verbindung & Authentifizierung

### Basis-URL und Ports
| | HTTP | HTTPS |
|---|---|---|
| Port | `58454` | `58452` |
| Basis | `http://localhost:58454/datev/api` | `https://localhost:58452/datev/api` |

HTTPS nutzt i. d. R. ein selbstsigniertes Zertifikat → beim Test Zertifikatsprüfung ggf. abschalten
(`curl -k`, PowerShell `-SkipCertificateCheck`). **In Produktion sauber lösen**, nicht generell
deaktivieren.

### Zwei Auth-Wege
1. **Integrierte Windows-Anmeldung (SSO)** — kein Passwort. Funktioniert, wenn der Aufruf unter dem
   angemeldeten DATEV-Windows-Benutzer läuft (Browser/PowerShell auf dem ASP-Server).
   - Im Browser: einfach die URL öffnen.
   - In PowerShell: `Invoke-RestMethod -UseDefaultCredentials`.
   - In Code (Fetch o. ä.): „credentials: include" / Kerberos-Negotiate.
2. **Basic Auth** — `Authorization: Basic base64("user:pass")`. **Das ist der Weg für einen
   Server-Dienst/Adapter**, der ohne interaktiven Windows-Login läuft.

### Identität prüfen (bestätigt Auth + zeigt Anmeldenamen)
```
GET {base}/iam/v1/Users/me
```

### Voraussetzungen am DATEVconnect-Benutzer (über DATEV-Rechteverwaltung; im ASP über DATEV/ASP-Partner)
- Rechte **„DATEVconnect"** **und** **„EO comfort connect"** (für Order Management).
- Sauber: eine eigene Rechtegruppe „Schnittstellen" mit **nur** den nötigen Erlaubnissen —
  **ein Verbot übersteuert jede Erlaubnis** (häufige 403-Ursache).
- Nach Rechteänderung am LAN-Server: DATEV-Arbeitsplatz einmal unter dem Login starten, Dienste
  `Datev.Connect.Server` und `Datev.ApplicationHost.Server` (bzw. „LocalAPIService") neu starten.
  **Im ASP übernimmt das der ASP-Partner.**

---

## 2. Welche APIs sind da? (Health-Check)

```
GET {base}/diagnostics/v1/echo       # Lebenszeichen
GET {base}/diagnostics/v1/domains    # listet installierte APIs
```

**Verifiziert vorhanden** (DATEVasp-Instanz, Juni 2026):
`order-management v1`, `master-data v1`, `accounting v1`, `dms v2`, `lodas v1`, `hr v3`,
`hr-lug v2`, `iam v1`. → Vor dem Einsatz immer per `domains` prüfen, ob die gewünschte API
gelistet ist (Lizenz/Modul-abhängig).

---

## 3. Lesen (GET)

### Order Management — die wichtigsten Endpunkte
```
GET {base}/order-management/v1/ordertypes               # Katalog der Auftragsarten
GET {base}/order-management/v1/orders                    # Aufträge (Liste)
GET {base}/order-management/v1/orders/{orderId}          # ein Auftrag (inkl. eingebetteter suborders[])
GET {base}/order-management/v1/orders/{orderId}/costitems        # buchbare Aufwandspositionen (Plan)
GET {base}/order-management/v1/orders/{orderId}/expensepostings  # erfasste Buchungen (Ist)
GET {base}/order-management/v1/orders/costitems          # globaler Positions-Überblick (Admin/Config)
```

### Mitarbeiter (GUID) liegen NICHT in Order Management
Order Management hat **keine** Namensliste (`/employeeswithgroup` lieferte 0 Datensätze). Die für
Buchungen nötige **Mitarbeiter-GUID** kommt aus den Stammdaten:
```
GET {base}/master-data/v1/employees?filter=contains(name,'Nachname')   # Feld id = employee_id
```

### Filter-Syntax (OData-artig)
- **String-Werte in Hochkommata:** `?filter=ordertype eq '106'`, `?filter=cost_type eq 'ZEI'`.
- Kombinierbar; weitere Filterfelder bei `/orders`: `creation_year`, `client_id`,
  `completion_status`, `billing_status`, `assessment_year`.
- `contains(name,'…')` funktioniert bei employees.

### Wichtige Eigenheit: `costitems` (Plan) vs. `expensepostings` (Ist)
- `costitems` = die **geplanten/buchbaren** Positionen eines Auftrags. Felder: `cost_position`,
  `cost_position_name`, `cost_type`, `unit_description`, `accounting_allowed`, `suborder_id` —
  **kein Mitarbeiter-Feld**.
- **Achtung:** `costitems` enthält pro Position **1 Basis-Zeile + 1 Zeile je Mitarbeiter, der
  darauf gebucht hat** (Zeilen unterscheiden sich nur in `id`). Für eine Auswahlliste „worauf
  kann ich buchen?" daher **nach `cost_position` deduplizieren** und nur `accounting_allowed = true`
  nehmen. `accounting_allowed` ist **dynamisch** (status­abhängig) → live auswerten, nicht cachen.
- `expensepostings` = die **tatsächlichen Buchungen** (Einzelposten je `cost_position` +
  `employee_id`).

---

## 3b. Verifizierte Feld-Referenz — Order-Objekt (Live, Juni 2026)

> Felder eines **echten** Auftrags aus `GET /orders` an einer produktiven Kanzlei-Instanz. Werte hier
> **generisch/anonymisiert** — sensible Kennungen (`client_id`, `*_responsible*_id`, `organization_id`
> …) sind GUIDs und gehören **nie** ins Repo.

| Feld | Typ | Bedeutung / Beispiel |
|---|---|---|
| `id` / `order_id` | int | Auftrags-ID (beide Felder identisch, z. B. `9993`) |
| `order_number` | int | Auftragsnummer (z. B. `354`) |
| `creation_year` | int | Anlagejahr (z. B. `2026`) |
| `order_number_predecessor` | int | **Auftragsnummer des Vorgängers** (z. B. `321`) |
| `creation_year_predecessor` | int | **Anlagejahr des Vorgängers** (z. B. `2025`) |
| `order_number_successor` / `creation_year_successor` | int | **Nachfolger-Auftrag** (Kette auch vorwärts) |
| `order_name` | string | Bezeichnung (z. B. „Lohnbuchführung") |
| `ordertype` | string | Auftragsart-Kurzcode (z. B. `202`) |
| `ordertype_group` | int | Gruppen-Code (z. B. `2`) |
| `assessment_year` | int | Veranlagungsjahr |
| `fiscal_year` | int | Wirtschaftsjahr (nur befüllt, wenn in EO aktiviert) |
| `isinternal` | bool | interne Auftragsart → **nicht** ins Board |
| `organization_id` | guid | Organisation |
| `establishment_id` | guid | Niederlassung/Betrieb |
| `functional_area_id` | guid | Funktionsbereich |
| `order_responsible1_id` | guid | verantwortlicher Mitarbeiter (GUID → `master-data/employees`) |
| `client_id` | guid | **Mandant** (→ Client Master Data) |
| `completion_status` | string | Bearbeitungsstatus (z. B. „work partially completed") |
| `date_completion_status` | date | Datum des Bearbeitungsstatus |
| `billing_status` | string | **Abrechnungsstatus** (z. B. „partially invoiced") → Controlling |
| `date_billing_status` | date | Datum des Abrechnungsstatus |
| `order_structure` | string | z. B. „calendar-structure" |
| `planned_turnover` | decimal | geplanter Umsatz |
| `planned_hours` | decimal | **Planstunden** (z. B. `18,0`) |
| `planned_hours_time_units` | int | Planstunden in Einheiten (**1 h = 1200**; 18 h → `21600`) |
| `planned_time_costs` | decimal | geplante Zeitkosten |
| `planned_expenses_costs` / `planned_material_costs` / `planned_external_costs` | decimal | geplante Aufwands-/Material-/Fremdkosten |
| `automatic_fee_active` | bool | automatische Gebühr aktiv |
| `automatic_fee_level` | int | Gebührenstufe |
| `invoice_type` | string | Rechnungstyp (z. B. „EIN") |

Teilaufträge kommen **eingebettet** im selben Objekt als `suborders[]` (siehe §4).

**Bestätigte Schlüsselbefunde (für jede künftige App relevant):**
- **Vorgänger-Verkettung ist explizit.** `order_number_predecessor` + `creation_year_predecessor`
  zeigen direkt auf den Vorjahres-/Vorperioden-Auftrag. Die Kette wiederkehrender Aufträge
  (Folgeauftrag) ist damit **ohne Heuristik** nachverfolgbar — Gold wert für jede App, die
  periodenübergreifende Daten übernehmen will (z. B. mandantenbezogene Einstellungen).
- **`planned_hours_time_units`: 1 h = 1200 Einheiten** — gilt auf **Plan-** und **Buchungsseite**.
- **`billing_status` ist befüllt** (beobachtet: „partially invoiced") → Abrechnungs-/Controlling-
  Auswertungen sind direkt aus dem Order-Objekt möglich.
- **Datenmenge beachten:** `GET /orders` lieferte an einer echten Kanzlei **~7.500 Aufträge** in
  **einer** Antwort. Für Produktion **filtern** (`creation_year`, `completion_status`, `client_id` …)
  oder Paging prüfen, statt jedes Mal den Gesamtbestand zu ziehen.

---

## 4. Zurückschreiben (PUT) — read-modify-write

**Regel:** `PUT` ersetzt das **komplette** Objekt. Niemals ein Teilobjekt senden — sonst gehen
Felder verloren. Immer:

```
1. GET  {base}/order-management/v1/orders/{orderId}   -> volles Objekt holen
2. nur die gewünschten Felder im Objekt ändern
3. PUT  {base}/order-management/v1/orders/{orderId}   -> geändertes Gesamtobjekt zurückschreiben
```

**⚠️ PUT verlangt ein VOLLSTÄNDIGES Objekt mit allen Pflichtfeldern (live verifiziert):**
`GET` liefert leere/nicht zutreffende Felder **nicht** mit; `PUT` verlangt aber alle Pflichtfelder.
Echo'st du ein sparsames GET-Objekt zurück, lehnt DATEV mit **`EODC10009`** ab und nennt das fehlende
Feld (z. B. `billingstatus`). **Pflichtfelder (Spec):** `id`, `order_id`, `creation_year`,
`order_number`, `order_name`, `ordertype`, `assessment_year`, `fiscal_year`, `organization_id`,
`establishment_id`, `functional_area_id`, `order_responsible1_id`, `client_id`, `completion_status`,
`billing_status`. → Read-Modify-Write muss **fehlende Pflichtfelder ergänzen** (aus Default/Sync).

**Gültige Werte (Enums, Spec):**
- `billing_status`: `open` · `partially invoiced` · `advance payment partially invoiced` ·
  `advance invoiced` · `invoiced`
- `completion_status`: `created/planned` · `started` · `interrupted` · `work partially completed` ·
  `work completed` · `done`
- `order_structure`: `total-order` · `consecutive-number` · `calendar-structure`

**Schreibbare Felder am Auftrag (`PUT /orders/{id}`):**
- `completion_status` — Auftragsstatus (Werte s. u.)
- `planned_start` / `planned_end` — Plandaten / Umplanung
- `planned_hours` / `planned_hours_time_units` — Planstunden
- `order_responsible1_id` / `order_responsible2_id` / `order_partner_id` — Verantwortliche

**`completion_status` — feste Werte:**
`created/planned` · `started` · `interrupted` · `work completed` · `work partially completed` ·
`done` (= erledigt). Begleitende Datumsfelder setzt DATEV automatisch (`completion_date`,
`interruption_date`, `resume_date`, `date_completion_status`). `resumed` geht nur aus `interrupted`.

**Teilauftrag (Suborder):**
```
PUT {base}/order-management/v1/orders/{orderId}/suborders/{suborderId}
```
Suborders kommen **eingebettet** im Order-GET (`order.suborders[]`). Schreibbar v. a.
`planned_hours_time_units`, `planned_start`, `planned_end` und **`date_work_completed`**
(= „Monat erledigt"). Es gibt **kein** `completion_status`-Enum auf Teilauftragsebene — ein Monat
wird über das **Erledigt-Datum** fertig gemeldet. Auch hier: erst GET, dann PUT des Gesamtobjekts.

---

## 5. Zeit-/Aufwandsbuchung (POST `expensepostings`) — VERIFIZIERT

Der **einzige POST** der Order-Management-API. Schreibtest erfolgreich (`HTTP 201`, Buchung in
EO Comfort sichtbar).

**Endpunkt (immer am Teilauftrag, nie am Gesamtauftrag):**
```
POST {base}/order-management/v1/orders/{orderId}/suborders/{suborderId}/expensepostings
```

**Pflichtfelder:**
- `employee_id` — Mitarbeiter-GUID (aus `master-data/v1/employees`, Feld `id`)
- `work_date` — Arbeitsdatum, Format `"TT.MM.JJJJ 00:00:00"` (z. B. `"26.06.2026 00:00:00"`)
- `cost_position` — Aufwandsposition (Code, z. B. `"906"`; aus `costitems`, `accounting_allowed`)
- **+ Berechnungsfeld je Kostenart** (s. Tabelle)

**Kostenart (`cost_type`) → erlaubte Felder:**
| `cost_type` | Felder |
|---|---|
| `time-costs` (Zeit) | `time_units` (+ optional `Start_time`); **ODER** `number_of_days` |
| `material-costs` | `number_of_units` ODER `cost_amount` |
| `expenses-costs` | `number_of_units` ODER `cost_amount` |
| `external-costs` | `cost_amount` |

**Fallstricke (alle am Live-System bestätigt):**
- **`time_units`: 1 Stunde = 1200 Einheiten** (4 h = 4800).
- **`id` beim POST NICHT senden** → sonst „key mismatch".
- **Ohne `Start_time` buchen** (reine Dauer). Wird `Start_time` gesendet, prüft DATEV auf
  **Zeitüberschneidung** und lehnt mit **`EODC20127`** ab. (Schreibweise bei Bedarf: `Start_time`
  mit großem S.)
- **POST ist NICHT idempotent**: gleicher Body zweimal → **zwei** Buchungen (Server vergibt `id`
  neu). Ein Sync **muss Dubletten selbst verhindern** (übertragene Einträge markieren / Idempotenz-
  Schlüssel mitführen).
- **Kein DELETE** — Korrektur/Storno nur in **EO Comfort**, nicht über die API.
- **`entry_date`** ist ein System-Stempel (von DATEV gesetzt). Maßgeblich ist **`work_date`** —
  der Sync-Zeitpunkt ist egal (entkoppelter Batch-Sync möglich).
- Optional: `comment` (≤255), `isbillable`, `fee_position`. `cost_amount` **nicht** bei `time-costs`.
- Query-Parameter `automaticintegration=true` → Buchung direkt in den Auftrag integrieren;
  fehlerhafte landen in der **ZMA-Massendatenerfassung**. Mit `deletemassdataonfailure=true` (nur
  zusammen mit `automaticintegration=true`) werden Fehlversuche automatisch verworfen.

**Beispiel-Body (Zeitbuchung 1 h):**
```json
{
  "employee_id": "<GUID-aus-master-data>",
  "work_date": "26.06.2026 00:00:00",
  "cost_position": "906",
  "time_units": 1200,
  "comment": "Beispiel",
  "isbillable": false
}
```

---

## 6. Was die API NICHT kann (wichtig fürs Architektur-Design)

- **Kein `POST /orders`** und **kein DELETE** → Aufträge werden **ausschließlich in DATEV**
  angelegt/gelöscht. Eine App spiegelt den Bestand (Pull) und schreibt nur Änderungen (PUT) +
  Buchungen (POST expensepostings) zurück.
- **Keine Einzel-Zeiteinträge mit Storno** → Buchungen sind nur additiv (POST), Korrektur in EO.
- **Kein zentraler Positions-Katalog als eigener Endpunkt** → buchbare Positionen sind
  **auftragsbezogen** über `costitems` lesbar (global über `GET /orders/costitems` für Überblick).

---

## 7. Fehler-Systematik (real beobachtet)

| HTTP / Code | Erkennungsmerkmal | Ursache | Lösung |
|---|---|---|---|
| **403** | leerer Body, Server-Header `Microsoft-HTTPAPI` | Windows/Kerberos-Handshake vor DATEV; meist ein **Verbot** in einer Gruppe | Verbot entfernen; eigene Gruppe nur mit Erlaubnissen |
| **403** | Body enthält **`DCO10400`** | Benutzer fehlt das **Bestandsrecht** | Rechte „DATEVconnect" + „EO comfort connect" erteilen |
| **406** | — | falscher/fehlender Accept-Header | `Accept: application/json; charset=utf-8` setzen |
| **404** | — | falscher Pfad/Port | Port (58454 HTTP / 58452 HTTPS), Pfad/Domain prüfen |
| **EODC20127** | — | Zeit-Überschneidung beim Buchen | Buchung **ohne** `Start_time` (nur `time_units`) |
| Netzwerkfehler | keine Antwort | Dienst aus / falscher Port / nicht auf dem DATEV-/ASP-Server | auf dem ASP-Server unter dem DATEV-Benutzer ausführen |

---

## 8. Fertiger Smoke-Test (PowerShell, auf dem ASP-Server ausführen)

Self-contained, **read-only**. Default = Windows-SSO (kein Passwort). Auf den ASP-Server kopieren
und ausführen: `powershell -ExecutionPolicy Bypass -File .\datev-smoke.ps1`

```powershell
param(
  [string]$BaseUrl = "http://localhost:58454/datev/api",
  [ValidateSet("sso","basic")] [string]$Auth = "sso",
  [string]$User, [string]$Pass,
  [switch]$Insecure
)
$ErrorActionPreference = "Stop"
$headers = @{ "Accept" = "application/json; charset=utf-8" }
$common  = @{}
if ($Auth -eq "basic") {
  if (-not $User) { $User = Read-Host "DATEVconnect-Benutzer" }
  if (-not $Pass) { $Pass = Read-Host "Passwort" }
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$User`:$Pass"))
  $headers["Authorization"] = "Basic $b64"
} else {
  $common["UseDefaultCredentials"] = $true   # Windows-SSO
}
if ($Insecure -and $PSVersionTable.PSVersion.Major -ge 6) { $common["SkipCertificateCheck"] = $true }

function Get-Datev($path) { Invoke-RestMethod -Uri "$BaseUrl/$path" -Headers $headers @common }

Write-Host "0) Identitaet..." -NoNewline
$me = Get-Datev "iam/v1/Users/me"; Write-Host " OK ($($me.userName))"

Write-Host "1) echo...     " -NoNewline; Get-Datev "diagnostics/v1/echo" | Out-Null; Write-Host "OK"
Write-Host "2) domains...  " -NoNewline
$d = Get-Datev "diagnostics/v1/domains"; Write-Host "OK -> $($d.domains.name -join ', ')"

Write-Host "3) ordertypes..." -NoNewline
$ot = Get-Datev "order-management/v1/ordertypes"; Write-Host " OK ($($ot.Count))"
Write-Host "4) orders...   " -NoNewline
$o = Get-Datev "order-management/v1/orders"; Write-Host "OK ($($o.Count))"
$o | Select-Object -First 5 id, order_number, ordertype, completion_status | Format-Table
Write-Host "`nFertig (nur gelesen, nichts veraendert)."
```

> **Reversibler Schreibtest (optional)** an einem **Test-Auftrag**: GET holen → `planned_hours`
> +1 → PUT → prüfen → Originalwert wieder per PUT zurücksetzen. So ist das Rückschreiben bewiesen,
> ohne bleibende Spuren. (POST `expensepostings` ist **nicht** reversibel — nur an einem Test-
> Auftrag und danach in EO entfernen.)

---

## 9. Benötigte OpenAPI-Specs (offline maßgeblich)

Diese JSON-Dateien sind die verbindliche Referenz für Felder/Schemas — ins neue Projekt mitnehmen:
- **`Order Management-1.4.9.json`** — Aufträge, Suborders, costitems, expensepostings (Kern).
- **`Diagnostics and Functional Tests-1.1.2.json`** — Health-Check, belegt `localhost:58454` + Basic Auth.
- `Client Master Data-1.7.1.json` — Mandanten/Mitarbeiter-Stammdaten.
- `Accounting-*.json`, `accounting_*.json` — Buchhaltung/Belege (perspektivisch).

---

## 10. Cloud-Alternative (nur zur Einordnung)

Es gibt neben On-Premise (dieses Dokument) den **Cloud-Weg** über das DATEV-API-Gateway
(`https://api.datev.de/...`, **OAuth 2.0/OIDC**, App-Registrierung im Developer-Portal,
Sandbox, Technical Review). Für eine **ASP-interne** Anwendung ist der On-Premise-Weg der
direktere; der Cloud-Weg ist relevant, wenn eine App **remote/zentral** außerhalb der ASP-
Umgebung betrieben werden soll. Endpunkte/Scopes dann im eingeloggten Portal verifizieren.

---

## 11. Checkliste für ein neues Projekt (was ihr nicht neu testen müsst)

- [x] Verbindung & SSO/Basic Auth funktionieren (verifiziert).
- [x] Pflicht-Header `Accept: application/json; charset=utf-8`.
- [x] Lesen: ordertypes / orders / orders/{id} (mit eingebetteten suborders) / costitems / expensepostings / employees.
- [x] Filter mit Hochkommata bei Strings.
- [x] Schreiben: PUT read-modify-write (Order + Suborder), `completion_status`, Plandaten, Stunden.
- [x] Buchen: POST expensepostings (1 h = 1200 units, ohne `Start_time`, nicht idempotent, kein DELETE).
- [x] Mitarbeiter-GUID kommt aus `master-data/v1/employees`.
- [ ] **Pro Kanzlei neu:** ordertype-Katalog einlesen, cost_position-Mapping, Hosting im ASP-Umfeld,
      Zugangsdaten/technischer Benutzer einrichten.
```

> Stand: Juni 2026, verifiziert an einer DATEVasp-Instanz. Bei API-Versionssprüngen Felder gegen
> die mitgelieferte OpenAPI-Spec gegenprüfen.
