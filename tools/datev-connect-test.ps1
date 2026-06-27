<#
.SYNOPSIS
  Testet den DATEVconnect-Zugriff (lesen + optional zurueckschreiben) fuer das Projekt
  Zeiterfassung & Auftragsabwicklung. Auszufuehren AUF dem ASP-Server (dort ist localhost
  = DATEVconnect). Windows PowerShell 5.1 genuegt (vorinstalliert).

.BESCHREIBUNG
  Authentifizierung:
    -Auth sso   (Standard) integrierte Windows-Anmeldung, KEIN Passwort
                (funktioniert, wenn das Skript unter dem angemeldeten DATEV-Benutzer laeuft).
    -Auth basic Benutzer + Passwort (Basic Auth), interaktiv abgefragt.

  Stufe 1 (Standard, NUR LESEN):
    0) iam/Users/me         -> Identitaet + Anmeldung pruefen (zeigt deinen Namen)
    1) diagnostics/echo     -> Lebenszeichen
    2) diagnostics/domains  -> welche APIs sind installiert (ist order-management dabei?)
    3) order-management/ordertypes + orders -> Auftragsdaten ziehen

  Stufe 2 (optional, SCHREIBT - nur an einem unkritischen TEST-Auftrag!):
    -TestWriteback -OrderId <id>
        Reversibler Roundtrip am Auftrag: GET -> planned_hours +1 -> PUT -> GET (pruefen)
        -> PUT zuruecksetzen (Originalwert). Beweist: Rueckschreiben UND dass Aenderungen greifen.
        Mit zusaetzlich -SuborderId <id>: derselbe reversible Roundtrip am Teilauftrag.
    -TestExpensePosting -OrderId <id> -SuborderId <id> -EmployeeId <guid> -CostPosition <code>
        Bucht 1 Stunde (time_units=1200, OHNE Start_time) auf den Teilauftrag.
        ACHTUNG: NICHT reversibel ueber die API (kein DELETE) - Korrektur nur in EO Comfort!

.BEISPIELE
  # Nur lesen, Windows-SSO (kein Passwort):
  powershell -ExecutionPolicy Bypass -File .\datev-connect-test.ps1

  # Mit Basic Auth statt SSO:
  .\datev-connect-test.ps1 -Auth basic

  # Anderer Port/HTTPS:
  .\datev-connect-test.ps1 -BaseUrl "https://localhost:58452/datev/api" -Insecure

  # Reversibler Rueckschreibtest am Auftrag (und optional Teilauftrag):
  .\datev-connect-test.ps1 -TestWriteback -OrderId "AUFTRAGS-ID"
  .\datev-connect-test.ps1 -TestWriteback -OrderId "AUFTRAGS-ID" -SuborderId "TEILAUFTRAGS-ID"

  # Zeitbuchung (nicht reversibel - nur am Test-Auftrag!):
  .\datev-connect-test.ps1 -TestExpensePosting -OrderId "ID" -SuborderId "ID" -EmployeeId "GUID" -CostPosition "906"
#>

[CmdletBinding()]
param(
  [string]$BaseUrl = "http://localhost:58454/datev/api",
  [ValidateSet('sso','basic')][string]$Auth = 'sso',
  [pscredential]$Credential,         # nur fuer -Auth basic
  [switch]$TestWriteback,
  [switch]$TestExpensePosting,
  [string]$OrderId,
  [string]$SuborderId,
  [string]$EmployeeId,
  [string]$CostPosition,
  [switch]$Insecure,                 # TLS-Zertifikatspruefung ueberspringen (HTTPS/Self-Signed)
  [int]$ShowOrders = 5
)

$ErrorActionPreference = 'Stop'

function Write-Head($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "OK  $t" -ForegroundColor Green }
function Write-Err($t)  { Write-Host "FEHLER  $t" -ForegroundColor Red }

# Ergebnis-Sammlung fuer die Zusammenfassung am Ende (an mich zurueckmelden)
$script:Summary = [ordered]@{}
function Note($key, $val) { $script:Summary[$key] = $val }

# --- Vorbereitung -----------------------------------------------------------
$BaseUrl = $BaseUrl.TrimEnd('/')

# Pflicht-Header laut DATEVconnect (sonst HTTP 406)
$accept = @{ Accept = 'application/json; charset=utf-8' }

# Authentifizierung vorbereiten
$authArgs = @{}
if ($Auth -eq 'sso') {
  $authArgs['UseDefaultCredentials'] = $true
  $authArgs['Headers'] = $accept
  Write-Host "Auth: integrierte Windows-Anmeldung (SSO) - kein Passwort." -ForegroundColor DarkGray
} else {
  if (-not $Credential) { $Credential = Get-Credential -Message "DATEVconnect-Benutzer (Basic Auth)" }
  $user = $Credential.UserName
  $pass = $Credential.GetNetworkCredential().Password
  $b64  = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$user`:$pass"))
  $authArgs['Headers'] = ($accept + @{ Authorization = "Basic $b64" })
  Write-Host "Auth: Basic ($user)." -ForegroundColor DarkGray
}

# TLS 1.2 + optional Zertifikatspruefung aus
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if ($Insecure) {
  [Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
  Write-Host "Hinweis: TLS-Zertifikatspruefung deaktiviert (-Insecure)." -ForegroundColor Yellow
}

function Invoke-DC {
  param([string]$Path, [string]$Method = 'Get', $Body)
  $uri = "$BaseUrl/$($Path.TrimStart('/'))"
  $args = @{ Uri = $uri; Method = $Method } + $authArgs
  if ($Body) { $args['Body'] = $Body; $args['ContentType'] = 'application/json' }
  try {
    return Invoke-RestMethod @args
  } catch {
    $code = $null; $bodyTxt = ''
    if ($_.Exception.Response) { try { $code = [int]$_.Exception.Response.StatusCode } catch {} }
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $bodyTxt = $_.ErrorDetails.Message }
    # Reale DATEVconnect-Fehlerklassen einordnen
    $hint = switch -Regex ("$code|$bodyTxt") {
      'DCO10400'        { "403/DCO10400: Bestandsrecht fehlt -> Rechte 'DATEVconnect' + 'EO comfort connect' erteilen." ; break }
      'EODC20127'       { "EODC20127: Zeit-Ueberschneidung -> Buchung OHNE Start_time senden (nur time_units)." ; break }
      '^403'            { "403: oft Windows/Kerberos (http.sys) - Verbot in einer Gruppe? 'Verbot schlaegt Erlaubnis'." ; break }
      '^406'            { "406: Accept-Header muss 'application/json; charset=utf-8' sein (ist gesetzt)." ; break }
      '^404'            { "404: Pfad/Port falsch - Port 58454 (HTTP) / 58452 (HTTPS), Domain via /diagnostics/v1/domains pruefen." ; break }
      default           { "" }
    }
    throw "[$Method $uri] HTTP $code - $($_.Exception.Message)$(if($hint){ ""`n        -> $hint"" })"
  }
}

Write-Host "DATEVconnect-Test gegen: $BaseUrl`n" -ForegroundColor White

# --- 0) Identitaet + Anmeldung ---------------------------------------------
Write-Head "0) iam/Users/me (Identitaet + Anmeldung)"
try {
  $me = Invoke-DC "iam/v1/Users/me"
  $name = $me.display_name; if (-not $name) { $name = $me.userName }
  if (-not $name -and $me.name) { $name = ($me.name.given_name, $me.name.family_name -join ' ').Trim() }
  Write-Ok "Angemeldet als: $name"
  Note 'Anmeldung' "OK ($name)"
} catch {
  Write-Err $_
  Note 'Anmeldung' "FEHLER"
  Write-Host "Pruefen: laeuft das Skript AUF dem ASP-Server unter dem DATEV-Benutzer? Rechte/Dienste/Port?" -ForegroundColor Yellow
  Write-Host "(Falls iam nicht vorhanden ist, geht es mit Schritt 1 weiter.)" -ForegroundColor DarkGray
}

# --- 1) Lebenszeichen -------------------------------------------------------
Write-Head "1) diagnostics/echo"
try { Invoke-DC "diagnostics/v1/echo" | Out-Null; Write-Ok "Schnittstelle antwortet."; Note 'Echo' 'OK' }
catch { Write-Err $_; Note 'Echo' 'FEHLER' }

# --- 2) Installierte APIs ---------------------------------------------------
Write-Head "2) diagnostics/domains (installierte APIs)"
try {
  $domains = Invoke-DC "diagnostics/v1/domains"
  $domains | ConvertTo-Json -Depth 6
  if (($domains | ConvertTo-Json -Depth 6) -match 'order-management') { Write-Ok "order-management verfuegbar."; Note 'order-management' 'verfuegbar' }
  else { Write-Host "WARNUNG: 'order-management' nicht gelistet." -ForegroundColor Yellow; Note 'order-management' 'NICHT gelistet' }
} catch { Write-Err $_; Note 'Domains' 'FEHLER' }

# --- 3) Daten ziehen --------------------------------------------------------
Write-Head "3) order-management: Auftragsarten + Auftraege (lesen)"
try { Invoke-DC "order-management/v1/ordertypes" | Out-Null; Write-Ok "ordertypes geladen."; Note 'ordertypes (lesen)' 'OK' }
catch { Write-Err $_; Note 'ordertypes (lesen)' 'FEHLER' }

try {
  $orders = Invoke-DC "order-management/v1/orders"
  $list = $orders; if ($orders.PSObject.Properties['orders']) { $list = $orders.orders }
  $list = @($list)
  Write-Ok "orders geladen (Anzahl: $($list.Count))."
  Note 'orders (lesen)' "OK ($($list.Count))"
  if ($list.Count -gt 0) {
    $list | Select-Object -First $ShowOrders | Format-Table -AutoSize
    Write-Host "Tipp: Eine ID aus 'id'/'order_id' fuer -OrderId verwenden." -ForegroundColor DarkGray
  }
} catch { Write-Err $_; Note 'orders (lesen)' 'FEHLER' }

# --- Helfer: reversibler planned_hours-Roundtrip ----------------------------
function Test-PlannedHoursRoundtrip {
  param([string]$Path, [string]$Label)
  # GET -> Wert merken -> +1 -> PUT -> GET (pruefen) -> PUT zuruecksetzen
  $obj = Invoke-DC $Path
  $orig = $obj.planned_hours
  $test = if ($orig -is [double] -or $orig -is [int]) { [math]::Round([double]$orig + 1, 2) } else { 1 }
  Write-Host "  $($Label): planned_hours $orig -> $test (Testwert)" -ForegroundColor DarkGray

  $obj.planned_hours = $test
  Invoke-DC $Path -Method Put -Body ($obj | ConvertTo-Json -Depth 30) | Out-Null

  $check = Invoke-DC $Path
  $took = ([double]$check.planned_hours -eq [double]$test)
  if ($took) { Write-Ok "$($Label): Aenderung wurde uebernommen (planned_hours=$($check.planned_hours))." }
  else { Write-Host "WARNUNG: $($Label): Aenderung nicht wie erwartet ($($check.planned_hours))." -ForegroundColor Yellow }

  # zuruecksetzen
  $check.planned_hours = $orig
  Invoke-DC $Path -Method Put -Body ($check | ConvertTo-Json -Depth 30) | Out-Null
  $restore = Invoke-DC $Path
  $restored = ([double]$restore.planned_hours -eq [double]$orig)
  if ($restored) { Write-Ok "$($Label): Originalwert wiederhergestellt ($orig)." }
  else { Write-Host "ACHTUNG: $($Label): Originalwert NICHT wiederhergestellt - in EO pruefen!" -ForegroundColor Red }
  return ($took -and $restored)
}

# --- 4) Rueckschreibtest (optional, reversibel) ----------------------------
if ($TestWriteback) {
  Write-Head "4) Rueckschreibtest (PUT, reversibel) - SCHREIBT in DATEV"
  if (-not $OrderId) { Write-Err "-TestWriteback benoetigt -OrderId <Test-Auftrag>."; return }

  Write-Host "ACHTUNG: reversibler PUT an Auftrag '$OrderId' (planned_hours +1, danach zurueck). Nur an einem TEST-Auftrag!" -ForegroundColor Yellow
  if ((Read-Host "Fortfahren? (ja/nein)") -ne 'ja') { Write-Host "Abgebrochen."; return }

  try {
    $ok = Test-PlannedHoursRoundtrip "order-management/v1/orders/$OrderId" "Auftrag"
    Note 'PUT Auftrag (reversibel)' ($(if ($ok) { 'OK' } else { 'unklar' }))
    Write-Host "Hinweis: PUT ueberschreibt KOMPLETT. Echte Aenderungen: erst GET, dann gezielt setzen (completion_status, planned_start/end ...)." -ForegroundColor DarkGray
  } catch { Write-Err $_; Note 'PUT Auftrag (reversibel)' 'FEHLER' }

  if ($SuborderId) {
    try {
      $okS = Test-PlannedHoursRoundtrip "order-management/v1/orders/$OrderId/suborders/$SuborderId" "Teilauftrag"
      Note 'PUT Teilauftrag (reversibel)' ($(if ($okS) { 'OK' } else { 'unklar' }))
      Write-Host "Hinweis: Auf Teilauftragsebene ist 'date_work_completed' das Erledigt-Feld (gleiche PUT-Mechanik)." -ForegroundColor DarkGray
    } catch { Write-Err $_; Note 'PUT Teilauftrag (reversibel)' 'FEHLER' }
  }
}

# --- 5) Zeitbuchung (optional, NICHT reversibel) ---------------------------
if ($TestExpensePosting) {
  Write-Head "5) Zeitbuchung (POST expensepostings) - SCHREIBT, NICHT reversibel ueber API"
  $missing = @()
  foreach ($p in 'OrderId','SuborderId','EmployeeId','CostPosition') { if (-not (Get-Variable $p -ValueOnly)) { $missing += $p } }
  if ($missing.Count) { Write-Err "-TestExpensePosting benoetigt: $($missing -join ', ')."; return }

  Write-Host "ACHTUNG: Bucht 1 Stunde auf Teilauftrag '$SuborderId'. Kein API-DELETE - Korrektur nur in EO Comfort!" -ForegroundColor Red
  if ((Read-Host "Wirklich buchen? (ja/nein)") -ne 'ja') { Write-Host "Abgebrochen."; return }

  # work_date = heute im DATEV-Format "dd.MM.yyyy 00:00:00"
  $workDate = (Get-Date).ToString('dd.MM.yyyy') + ' 00:00:00'
  # 1 Stunde = 1200 time_units; OHNE Start_time (sonst EODC20127); id NICHT senden
  $posting = @{
    employee_id   = $EmployeeId
    work_date     = $workDate
    cost_position = $CostPosition
    cost_type     = 'time-costs'
    time_units    = 1200
    comment       = 'Testbuchung Zeiterfassungs-App (1 h)'
    isbillable    = $false
  }
  $body = $posting | ConvertTo-Json -Depth 10
  try {
    $res = Invoke-DC "order-management/v1/orders/$OrderId/suborders/$SuborderId/expensepostings" -Method Post -Body $body
    Write-Ok "Zeitbuchung erfolgreich (HTTP 201). In EO unter 'Zeiten' sichtbar; dort wieder entfernen."
    Note 'POST expensepostings' 'OK (in EO loeschen!)'
    if ($res) { $res | ConvertTo-Json -Depth 8 }
  } catch { Write-Err $_; Note 'POST expensepostings' 'FEHLER' }
}

# --- Zusammenfassung --------------------------------------------------------
Write-Head "Zusammenfassung (bitte zurueckmelden)"
$script:Summary.GetEnumerator() | ForEach-Object { "{0,-28} {1}" -f $_.Key, $_.Value } | Write-Host
Write-Host "`nFertig." -ForegroundColor Cyan
