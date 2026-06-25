<#
.SYNOPSIS
  Testet den DATEVconnect-Zugriff (lesen + optional zurueckschreiben) fuer das Projekt
  Zeiterfassung & Auftragsabwicklung. Auszufuehren AUF dem ASP-Server (dort ist localhost
  = DATEVconnect). Windows PowerShell 5.1 genuegt (vorinstalliert).

.BESCHREIBUNG
  Stufe 1 (Standard, NUR LESEN):
    1) diagnostics/echo     -> Verbindung + Anmeldung pruefen
    2) diagnostics/domains  -> welche APIs sind installiert (ist order-management dabei?)
    3) order-management/ordertypes + orders -> Auftragsdaten ziehen
  Stufe 2 (optional, SCHREIBT): -TestWriteback mit -OrderId
    Holt einen Auftrag und schreibt ihn UNVERAENDERT per PUT zurueck (Idempotenz-Test).
    NUR an einem unkritischen TEST-Auftrag verwenden.

.BEISPIELE
  # Nur lesen (fragt Benutzer/Passwort interaktiv ab):
  powershell -ExecutionPolicy Bypass -File .\datev-connect-test.ps1

  # Anderer Port/HTTPS:
  .\datev-connect-test.ps1 -BaseUrl "https://localhost:58452/datev/api" -Insecure

  # Rueckschreibtest an einem Test-Auftrag:
  .\datev-connect-test.ps1 -TestWriteback -OrderId "AUFTRAGS-ID"
#>

[CmdletBinding()]
param(
  [string]$BaseUrl = "http://localhost:58454/datev/api",
  [pscredential]$Credential,
  [switch]$TestWriteback,
  [string]$OrderId,
  [switch]$Insecure,          # TLS-Zertifikatspruefung ueberspringen (nur fuer Test/HTTPS mit Self-Signed)
  [int]$ShowOrders = 5        # wie viele Auftraege in der Konsole anzeigen
)

$ErrorActionPreference = 'Stop'

function Write-Head($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "OK  $t" -ForegroundColor Green }
function Write-Err($t)  { Write-Host "FEHLER  $t" -ForegroundColor Red }

# --- Vorbereitung -----------------------------------------------------------
$BaseUrl = $BaseUrl.TrimEnd('/')

if (-not $Credential) {
  $Credential = Get-Credential -Message "DATEVconnect-Benutzer (Benutzer-/Rechteverwaltung)"
}
$user = $Credential.UserName
$pass = $Credential.GetNetworkCredential().Password
$b64  = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$user`:$pass"))
$headers = @{ Authorization = "Basic $b64" }

# TLS 1.2 erzwingen (aeltere PS-Defaults); optional Zertifikatspruefung aus
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if ($Insecure) {
  [Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
  Write-Host "Hinweis: TLS-Zertifikatspruefung ist deaktiviert (-Insecure)." -ForegroundColor Yellow
}

function Invoke-DC {
  param([string]$Path, [string]$Method = 'Get', $Body)
  $uri = "$BaseUrl/$($Path.TrimStart('/'))"
  try {
    if ($Body) {
      return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers `
        -ContentType 'application/json' -Body $Body
    }
    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    throw "[$Method $uri] HTTP $code - $($_.Exception.Message)"
  }
}

Write-Host "DATEVconnect-Test gegen: $BaseUrl" -ForegroundColor White
Write-Host "Benutzer: $user`n" -ForegroundColor DarkGray

# --- 1) Verbindung + Anmeldung ---------------------------------------------
Write-Head "1) diagnostics/echo (Verbindung + Anmeldung)"
try {
  $echo = Invoke-DC "diagnostics/v1/echo"
  Write-Ok "Verbindung steht, Anmeldung akzeptiert."
  if ($echo) { $echo | ConvertTo-Json -Depth 5 }
} catch {
  Write-Err $_
  Write-Host "Pruefen: laeuft das Skript AUF dem ASP-Server? Port (HTTP 58454 / HTTPS 58452)? Benutzer/Rechte/Windows-Basic?" -ForegroundColor Yellow
  return
}

# --- 2) Installierte APIs ---------------------------------------------------
Write-Head "2) diagnostics/domains (welche APIs sind installiert)"
try {
  $domains = Invoke-DC "diagnostics/v1/domains"
  $domains | ConvertTo-Json -Depth 6
  $raw = ($domains | ConvertTo-Json -Depth 6)
  if ($raw -match 'order-management') { Write-Ok "order-management ist verfuegbar." }
  else { Write-Host "WARNUNG: 'order-management' nicht in der Domain-Liste gefunden." -ForegroundColor Yellow }
} catch { Write-Err $_ }

# --- 3) Daten ziehen --------------------------------------------------------
Write-Head "3) order-management: Auftragsarten + Auftraege (lesen)"
try {
  $ordertypes = Invoke-DC "order-management/v1/ordertypes"
  $n = (@($ordertypes).Count); if ($ordertypes.PSObject.Properties['ordertypes']) { $n = (@($ordertypes.ordertypes).Count) }
  Write-Ok "ordertypes geladen (Eintraege: $n)."
} catch { Write-Err $_ }

try {
  $orders = Invoke-DC "order-management/v1/orders"
  $list = $orders
  if ($orders.PSObject.Properties['orders']) { $list = $orders.orders }
  $list = @($list)
  Write-Ok "orders geladen (Anzahl: $($list.Count))."
  if ($list.Count -gt 0) {
    Write-Host "Erste $([Math]::Min($ShowOrders,$list.Count)) Auftraege:" -ForegroundColor DarkGray
    $list | Select-Object -First $ShowOrders | Format-Table -AutoSize
    Write-Host "Tipp: Eine ID aus der Spalte 'id'/'order_id' fuer -OrderId verwenden." -ForegroundColor DarkGray
  }
} catch { Write-Err $_ }

# --- 4) Rueckschreibtest (optional) ----------------------------------------
if ($TestWriteback) {
  Write-Head "4) Rueckschreibtest (PUT) - SCHREIBT in DATEV"
  if (-not $OrderId) { Write-Err "-TestWriteback benoetigt -OrderId <Test-Auftrag>."; return }

  Write-Host "ACHTUNG: Dies schreibt per PUT an Auftrag '$OrderId' (unveraendert zurueck)." -ForegroundColor Yellow
  Write-Host "Nur an einem UNKRITISCHEN Test-Auftrag ausfuehren." -ForegroundColor Yellow
  $answer = Read-Host "Fortfahren? (ja/nein)"
  if ($answer -ne 'ja') { Write-Host "Abgebrochen."; return }

  try {
    $order = Invoke-DC "order-management/v1/orders/$OrderId"
    Write-Ok "Auftrag geladen."
    $body = $order | ConvertTo-Json -Depth 30
    Invoke-DC "order-management/v1/orders/$OrderId" -Method Put -Body $body | Out-Null
    Write-Ok "PUT erfolgreich - Rueckschreiben funktioniert."
    Write-Host "Hinweis: PUT ueberschreibt das Objekt KOMPLETT. Fuer echte Aenderungen erst GET, dann gezielt Felder setzen (completion_status, planned_start/end, planned_hours ...)." -ForegroundColor DarkGray
  } catch {
    Write-Err $_
    Write-Host "Falls HTTP 400: Body-Struktur gegen das 'order'-Schema der Spec pruefen (Order Management-1.4.9.json)." -ForegroundColor Yellow
  }
}

Write-Host "`nFertig." -ForegroundColor Cyan
