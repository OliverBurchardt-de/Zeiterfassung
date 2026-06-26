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
  Stufe 2 (optional, SCHREIBT): -TestWriteback mit -OrderId
    Holt einen Auftrag und schreibt ihn UNVERAENDERT per PUT zurueck (Idempotenz-Test).
    NUR an einem unkritischen TEST-Auftrag verwenden.

.BEISPIELE
  # Nur lesen, Windows-SSO (kein Passwort):
  powershell -ExecutionPolicy Bypass -File .\datev-connect-test.ps1

  # Mit Basic Auth statt SSO:
  .\datev-connect-test.ps1 -Auth basic

  # Anderer Port/HTTPS:
  .\datev-connect-test.ps1 -BaseUrl "https://localhost:58452/datev/api" -Insecure

  # Rueckschreibtest an einem Test-Auftrag:
  .\datev-connect-test.ps1 -TestWriteback -OrderId "AUFTRAGS-ID"
#>

[CmdletBinding()]
param(
  [string]$BaseUrl = "http://localhost:58454/datev/api",
  [ValidateSet('sso','basic')][string]$Auth = 'sso',
  [pscredential]$Credential,         # nur fuer -Auth basic
  [switch]$TestWriteback,
  [string]$OrderId,
  [switch]$Insecure,                 # TLS-Zertifikatspruefung ueberspringen (HTTPS/Self-Signed)
  [int]$ShowOrders = 5
)

$ErrorActionPreference = 'Stop'

function Write-Head($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "OK  $t" -ForegroundColor Green }
function Write-Err($t)  { Write-Host "FEHLER  $t" -ForegroundColor Red }

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
} catch {
  Write-Err $_
  Write-Host "Pruefen: laeuft das Skript AUF dem ASP-Server unter dem DATEV-Benutzer? Rechte/Dienste/Port?" -ForegroundColor Yellow
  Write-Host "(Falls iam nicht vorhanden ist, geht es mit Schritt 1 weiter.)" -ForegroundColor DarkGray
}

# --- 1) Lebenszeichen -------------------------------------------------------
Write-Head "1) diagnostics/echo"
try { Invoke-DC "diagnostics/v1/echo" | Out-Null; Write-Ok "Schnittstelle antwortet." }
catch { Write-Err $_ }

# --- 2) Installierte APIs ---------------------------------------------------
Write-Head "2) diagnostics/domains (installierte APIs)"
try {
  $domains = Invoke-DC "diagnostics/v1/domains"
  $domains | ConvertTo-Json -Depth 6
  if (($domains | ConvertTo-Json -Depth 6) -match 'order-management') { Write-Ok "order-management verfuegbar." }
  else { Write-Host "WARNUNG: 'order-management' nicht gelistet." -ForegroundColor Yellow }
} catch { Write-Err $_ }

# --- 3) Daten ziehen --------------------------------------------------------
Write-Head "3) order-management: Auftragsarten + Auftraege (lesen)"
try { Invoke-DC "order-management/v1/ordertypes" | Out-Null; Write-Ok "ordertypes geladen." }
catch { Write-Err $_ }

try {
  $orders = Invoke-DC "order-management/v1/orders"
  $list = $orders; if ($orders.PSObject.Properties['orders']) { $list = $orders.orders }
  $list = @($list)
  Write-Ok "orders geladen (Anzahl: $($list.Count))."
  if ($list.Count -gt 0) {
    $list | Select-Object -First $ShowOrders | Format-Table -AutoSize
    Write-Host "Tipp: Eine ID aus 'id'/'order_id' fuer -OrderId verwenden." -ForegroundColor DarkGray
  }
} catch { Write-Err $_ }

# --- 4) Rueckschreibtest (optional) ----------------------------------------
if ($TestWriteback) {
  Write-Head "4) Rueckschreibtest (PUT) - SCHREIBT in DATEV"
  if (-not $OrderId) { Write-Err "-TestWriteback benoetigt -OrderId <Test-Auftrag>."; return }

  Write-Host "ACHTUNG: PUT an Auftrag '$OrderId' (unveraendert zurueck). Nur an einem TEST-Auftrag!" -ForegroundColor Yellow
  if ((Read-Host "Fortfahren? (ja/nein)") -ne 'ja') { Write-Host "Abgebrochen."; return }

  try {
    $order = Invoke-DC "order-management/v1/orders/$OrderId"
    Write-Ok "Auftrag geladen."
    $body = $order | ConvertTo-Json -Depth 30
    Invoke-DC "order-management/v1/orders/$OrderId" -Method Put -Body $body | Out-Null
    Write-Ok "PUT erfolgreich - Rueckschreiben funktioniert."
    Write-Host "Hinweis: PUT ueberschreibt KOMPLETT. Fuer echte Aenderungen erst GET, dann Felder gezielt setzen (completion_status, planned_start/end, planned_hours ...)." -ForegroundColor DarkGray
  } catch {
    Write-Err $_
    Write-Host "Bei HTTP 400: Body gegen das 'order'-Schema der Spec pruefen (Order Management-1.4.9.json)." -ForegroundColor Yellow
  }
}

Write-Host "`nFertig." -ForegroundColor Cyan
