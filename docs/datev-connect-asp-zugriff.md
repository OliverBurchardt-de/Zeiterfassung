# DATEVconnect-Zugriff für ASP-Nutzer — Daten ziehen & zurückschreiben

> Stand: 25. Juni 2026. Recherche über DATEV-Hilfe-Center/Community (Developer-Portal und
> DATEV-Domains liefern auf maschinelle Abrufe 403). Endpunkte aus den OpenAPI-Specs im Repo
> (`Order Management-1.4.9.json`, `Diagnostics and Functional Tests-1.1.2.json`).
> **Mit ASP-spezifischen Punkten unbedingt den DATEV-ASP-Ansprechpartner / Systempartner
> abstimmen** — markiert mit **(mit DATEV klären)**.

## Teststatus — 25.06.2026: Verbindung erfolgreich ✅

Erster Verbindungstest **auf dem ASP-Server im Browser**, ohne Skript, durchgeführt:

| Test (Browser-GET) | Ergebnis |
|---|---|
| `…/iam/v1/Users/me` | ✅ angemeldet **per Windows-SSO ohne Passwort**; korrekt als Nutzer erkannt (Rechte: IamAdministrator) |
| `…/diagnostics/v1/domains` | ✅ verfügbare APIs: **`order-management` v1**, `master-data` v1, `accounting` v1, `dms` v2, `lodas` v1, `hr` v3, `hr-lug` v2, `iam` v1 |
| `…/order-management/v1/orders` | ✅ liefert **echte Auftragsdaten** (lesend) — Auftragsarten (z. B. Lohnbuchführung, Mehraufwand Lohn, Prüfung von Steuerbescheiden mit Nummern), `completion_status` (started/work partially completed/done), Abrechnungs-Kennzeichen, Plandaten |

**Damit bestätigt:** DATEVconnect erreichbar, Anmeldung (SSO) funktioniert, Order-Management-API
liefert Lesedaten. Beobachtung deckt sich mit dem Datenmodell (Auftragsart kommt als **Nummer** →
Mapping „Nummer → Typ/Farbe" nötig, siehe `datev-integration.md`).

### Vertiefung — 26.06.2026: Aufwandsbuchung & Stammdaten (lesend, am internen 9801-Auftrag)
Per PowerShell (SSO) verifiziert — Details/Konsequenzen in `datev-integration.md`:

| Test (GET) | Erkenntnis |
|---|---|
| `…/orders?filter=ordertype eq '9801'` | String-Filter brauchen **Hochkommata**; Kanzleiauftrag (intern) gefunden |
| `…/orders/{id}/costitems` | **buchbare Aufwandspositionen** (Plan); `accounting_allowed`, `cost_type=time-costs`, `suborder_id`; **kein** Mitarbeiter-Feld. Eigenheit: 1 Basis-Zeile + 1 Zeile je buchendem Mitarbeiter (905 „Berufsschule" ohne Buchung → genau 1 Zeile) → für Auswahlliste **nach `cost_position` deduplizieren** |
| `…/orders/{id}/expensepostings` | **Ist-Buchungen** (Einzelposten; 1105 auf dem Auftrag) → EO-Ansicht „Zeiten" = aggregiert nach Position + Mitarbeiter |
| `…/master-data/v1/employees?filter=contains(name,…)` | **Mitarbeiter-GUID** (`id`) für `employee_id` — Order Management hat **keine** Namensliste |

**Noch offen:** der **Schreibtest** (`POST …/expensepostings`, HTTP 201) — Format/Pfad stehen
(s. `datev-integration.md`), Ausführung am Test-Auftrag noch ausstehend.

**Entscheidung (25.06.2026):** **Externer Zugriff ist nicht nötig** — die App soll **innerhalb der
ASP-Umgebung** laufen. Damit ist `localhost` für die App erreichbar (Test bestanden); die Wege
**B (VPN) und C (Cloud Gateway) entfallen**. Relevant bleibt nur, **wie die App im ASP-Umfeld
gehostet** wird (Weg A, „Anbindung Drittanbieter") — das mit DATEV/ASP-Partner klären.

**Noch offen (nicht dringend, technisch unkritisch für den Anwender):**
1. **Rückschreiben (PUT)** testen — geht nicht im Browser; über `tools/datev-connect-test.ps1`
   (`-TestWriteback -OrderId …`) an einem Test-Auftrag auf dem ASP-Server.
2. **Hosting der App im ASP-Umfeld** (Weg A) mit DATEV/ASP-Partner klären — kein Netz-/VPN-Thema mehr.

## 0. Die entscheidende ASP-Besonderheit

DATEVconnect ist eine **lokale LAN-Schnittstelle**: Der Dienst läuft auf **genau einem Server,
auf dem die DATEV-Programme installiert sind**, und antwortet dort unter
`http://localhost:58454` (HTTP) bzw. `:58452` (HTTPS), Basic Auth.

Als **ASP-Nutzer** liegt dieser Server **im DATEV-Rechenzentrum (Nürnberg)**, nicht im
Kanzleibüro. Daraus folgt:

- `localhost:58454` funktioniert **nur direkt auf dem ASP-Server** (im gehosteten DATEV-Desktop).
- Eine **eigene App im Kanzleinetz** (oder in der Cloud) erreicht DATEVconnect **nicht von allein** —
  es braucht einen der drei Anbindungswege unten. Zugriffsarten wie *Mobile Workstation* oder
  *ASPOnline* reichen **nicht** (keine dauerhafte LAN-LAN-Kopplung).

Das betrifft direkt unseren M2-Plan („On-Prem-App im Kanzleinetz ruft localhost") — der gilt für
klassische LAN-Installationen, **für ASP ist er anzupassen**.

## 1. Drei Wege, wie unsere App DATEVconnect erreicht

| Weg | Was | Für uns geeignet? |
|---|---|---|
| **A — App im ASP-Umfeld** (Zusatzmodul „Anbindung Drittanbieter", Art.-Nr. 42595) | Ausgewählte **standardisierte** Drittanbieter-Lösungen laufen direkt auf dem ASP-Serversystem | Eher nein: gilt für gelistete Standard-Lösungen, **nicht ohne Weiteres für eine Eigenentwicklung (mit DATEV klären)** |
| **B — Permanente LAN-LAN-Kopplung** (ASP-Site-Router oder **Site-to-Site-VPN**) | Dauerhafte Netzkopplung zwischen unserem App-Server und dem ASP-RZ; die App spricht DATEVconnect über das Netz an | Möglich; erfordert Netzbeauftragung **(mit DATEV klären)** |
| **C — Cloud Gateway for DATEVconnect** | DATEV-Middleware, die die **eigene** DATEVconnect-Schnittstelle für (Cloud-)Anwendungen verfügbar macht, ohne lokale Infrastruktur | **Wahrscheinlich der sauberste Weg** für eine selbst gehostete/Cloud-App; gibt es speziell „in DATEVasp" **(mit DATEV klären/bestellen)** |

**Empfehlung:** Mit dem DATEV-ASP-Ansprechpartner klären, welcher Weg für eine **Eigenentwicklung**
freigegeben wird — realistisch **B (Site-to-Site-VPN)** oder **C (Cloud Gateway)**. Davon hängt ab,
wo unser App-Backend/DATEV-Adapter (M2) läuft.

## 2. Voraussetzungen (unabhängig vom Weg)

1. **Lizenz/Installation:** DATEV **Eigenorganisation comfort / Auftragswesen** (Quelle der
   Aufträge → Order-Management-API) und **DATEVconnect** (bei euch installiert ✓).
2. **DATEVconnect-Benutzer** in **DATEV Benutzerverwaltung** + **Rechteverwaltung** anlegen und die
   Rechte freigeben — konkret **„DATEVconnect"** und **„EO comfort connect"** (siehe §6). Kein
   Admin-Recht, aber Windows-Anmeldung möglich.
3. **Authentifizierung:** Zwei Wege (siehe §6):
   - **Integrierte Windows-Anmeldung (SSO)** — kein Passwort; funktioniert, wenn der Aufruf unter
     dem angemeldeten DATEV-Windows-Benutzer läuft (z. B. Browser/PowerShell auf dem ASP-Server).
   - **Basic Auth** (Windows/Basic) — Benutzer + Passwort; für den späteren Server-Adapter.
   In beiden Fällen ist der Header **`Accept: application/json; charset=utf-8`** Pflicht (sonst 406).

## 3. Konkreter Test — in zwei Stufen

### Stufe 1: Sofort auf dem ASP-Server testen (ohne neues Modul)
Im gehosteten DATEV-Desktop (dort ist `localhost` erreichbar). Mit dem DATEVconnect-Benutzer.
**(Ob Browser/PowerShell auf dem ASP-Server nutzbar sind, ggf. mit DATEV klären.)**

> **Fertiges Test-Skript:** `tools/datev-connect-test.ps1` prüft Identität (iam/Users/me) →
> echo → domains → orders (nur lesen) und optional einen Rückschreibtest. Standard ist
> **Windows-SSO (kein Passwort)**. Auf den ASP-Server kopieren und ausführen:
> `powershell -ExecutionPolicy Bypass -File .\datev-connect-test.ps1`
> (Basic statt SSO: `-Auth basic`; Rückschreiben: `-TestWriteback -OrderId "<Test-Auftrag>"`).

**a) Verbindung + Auth + verfügbare APIs:**
```
GET http://localhost:58454/datev/api/iam/v1/Users/me          # Identität (bestätigt Auth + zeigt Anmeldenamen)
GET http://localhost:58454/datev/api/diagnostics/v1/echo      # Lebenszeichen
GET http://localhost:58454/datev/api/diagnostics/v1/domains   # listet installierte APIs → ist order-management dabei?
```
Der einfachste Test: die erste URL **im Browser auf dem ASP-Server** öffnen — dank Windows-SSO
erscheint dein Anmeldename ohne Passwort. Im Browser geht nur GET; für PUT braucht es
PowerShell/curl/Postman.

**b) Daten ziehen (Order Management):**
```
GET .../datev/api/order-management/v1/ordertypes
GET .../datev/api/order-management/v1/orders
GET .../datev/api/order-management/v1/orders/{orderid}
```

**c) Zurückschreiben — an einem TEST-Auftrag** (PUT überschreibt das Objekt **komplett** →
immer erst GET, dann das geänderte Objekt zurückschreiben):
```
GET  .../order-management/v1/orders/{orderid}      # aktuelles Objekt holen
PUT  .../order-management/v1/orders/{orderid}      # geändertes Objekt zurückschreiben
```
Schreibbare Felder u. a.: `completion_status` (Status), `planned_start`/`planned_end` (Umplanung),
`planned_hours`, `order_responsible*`/`order_partner_id`. Auf Teilauftragsebene:
`PUT .../orders/{orderid}/suborders/{suborderid}` (`date_work_completed`, Planstunden).

**PowerShell-Beispiele (Windows):**
```powershell
$user = "DATEVconnect-Benutzer"; $pass = "PASSWORT"
$b64  = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$user`:$pass"))
$h    = @{ Authorization = "Basic $b64" }
$base = "http://localhost:58454/datev/api"

# Test + Lesen
Invoke-RestMethod -Uri "$base/diagnostics/v1/echo"            -Headers $h
Invoke-RestMethod -Uri "$base/diagnostics/v1/domains"         -Headers $h
Invoke-RestMethod -Uri "$base/order-management/v1/orders"     -Headers $h

# Rückschreiben (Test-Auftrag): holen -> ändern -> PUT
$id = "AUFTRAGS-ID"
$o  = Invoke-RestMethod -Uri "$base/order-management/v1/orders/$id" -Headers $h
$o.planned_hours = 12                                   # Beispiel-Änderung
$body = $o | ConvertTo-Json -Depth 25
Invoke-RestMethod -Uri "$base/order-management/v1/orders/$id" -Method Put `
  -Headers ($h + @{ 'Content-Type' = 'application/json' }) -Body $body
```
*(Genaue Body-Struktur entspricht der GET-Antwort bzw. dem `order`-Schema der Spec. Erst an einem
unkritischen Test-Auftrag verifizieren.)*

**curl-Alternative:**
```
curl -u USER:PASS http://localhost:58454/datev/api/diagnostics/v1/echo
curl -u USER:PASS http://localhost:58454/datev/api/order-management/v1/orders
```

### Stufe 2: Aus der App-Umgebung testen
Sobald der Anbindungsweg (A/B/C) steht: dieselben Calls aus der Umgebung, in der unser
App-Backend/DATEV-Adapter laufen wird. Das ist der eigentliche Integrationstest (inkl. HTTPS
`:58452`, Zertifikat, Netzweg/Firewall).

## 4. Nächste Schritte
1. **DATEV-ASP klären (Blocker für M2-Architektur):** Welcher Zugriffsweg ist für eine
   **Eigenentwicklung** freigegeben — Site-to-Site-VPN (B) oder Cloud Gateway (C)? Kosten/Bestellung?
2. **Stufe-1-Test** auf dem ASP-Server: `echo`/`domains` → `orders` lesen → PUT an einem
   Test-Auftrag. Damit ist bestätigt, dass Lizenz, Benutzer/Rechte und Order-Management-API stehen.
3. Ergebnis hier dokumentieren; danach DATEV-Adapter (M2) gegen den gewählten Weg bauen.

## 6. Erkenntnisse aus einem funktionierenden Kollegen-Setup

Quelle: „DATEVconnect – Erste Schritte" von **Eike Hagena** (StB), als HTML-Smoke-Test im Repo
(`DATEVconnect-Erste-Schritte_von-Eike-Hagena.md`). **Achtung:** Das ist ein **eigener LAN-Server
mit Admin-Rechten** — Rechtevergabe und Dienst-Neustart kann die Kanzlei dort selbst; **unter ASP
laufen diese Schritte i. d. R. über DATEV bzw. den ASP-Partner.** Die Methodik ist übertragbar.

### Authentifizierung in der Praxis
- Der Test nutzt **integrierte Windows-Anmeldung** (`fetch(..., {credentials:'include'})`) — **kein
  Passwort**. Auf dem Rechner, auf dem DATEVconnect läuft und der DATEV-Benutzer angemeldet ist,
  „kennt" die Schnittstelle den Nutzer bereits (SSO). Für unseren Server-Adapter bleibt Basic Auth
  die Alternative.
- Pflicht-Header: **`Accept: application/json; charset=utf-8`** (sonst 406).
- Identitäts-Endpunkt: **`/datev/api/iam/v1/Users/me`** (IAM-Domain) — bestätigt Auth und liefert
  den Anmeldenamen. (Auf der ASP-Instanz via `/diagnostics/v1/domains` prüfen, ob `iam` gelistet ist.)

### Fehler-Systematik (real beobachtet)
| HTTP | Erkennungsmerkmal | Ursache | Lösung |
|---|---|---|---|
| **403** | leerer Body / Server-Header `Microsoft-HTTPAPI` | Windows/Kerberos-Handshake (http.sys) **vor** DATEV; meist **Verbot** in einer Gruppe | Verbot entfernen; eigene Gruppe „Schnittstellen" nur mit Erlaubnissen — **Verbot schlägt Erlaubnis** |
| **403** | Body enthält **`DCO10400`** | Benutzer fehlt das **Bestandsrecht** | Rechte „DATEVconnect" + „EO comfort connect" erteilen |
| **406** | — | falscher/fehlender Accept-Header | `Accept: application/json; charset=utf-8` setzen |
| **404** | — | falscher Pfad/Port | Port prüfen (58454 HTTP / 58452 HTTPS), Pfad/Domain prüfen |
| Netzwerkfehler | keine Antwort | Dienst aus / falscher Port / nicht auf DATEV-Rechner | auf DATEV-Arbeitsplatz ausführen, Dienst/Port prüfen |

### Rechte & Aktivierung (LAN-Setup; unter ASP über DATEV/ASP-Partner)
1. Benutzer in der Rechteverwaltung die Rechte **„DATEVconnect"** und **„EO comfort connect"** geben.
2. Sauber über eine **eigene Gruppe „Schnittstellen"** mit *nur* den nötigen Rechten (keine Verbote,
   da Verbote Erlaubnisse übersteuern).
3. Aktivierungssequenz: DATEV-Arbeitsplatz unter dem Login einmal starten → Dienste
   **`Datev.Connect.Server`** und **`Datev.ApplicationHost.Server`** neu starten.

## 5. Quellen
- DATEV Hilfe-Center: „Einsatz von DATEVconnect unter DATEVasp" (Dok. 1049306),
  „Benutzer für DATEVconnect … anlegen" (1003185), „Drittanbieterlösungen in DATEVasp".
- DATEV: „Einsatz Cloud Gateway for DATEVconnect in DATEVasp" (PDF),
  „DATEVasp Zusatzmodul Anbindung Drittanbieter" (Art.-Nr. 42595).
- OpenAPI-Specs im Repo: `Order Management-1.4.9.json`, `Diagnostics and Functional Tests-1.1.2.json`.
