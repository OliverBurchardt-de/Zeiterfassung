<#
  DATEVconnect – Erreichbarkeitstest VON AUSSERHALB des ASP
  =========================================================
  Zweck: Prüfen, ob DATEVconnect (Order Management etc.) jetzt auch aus dem
  Kanzleinetz / von einem PC ausserhalb der ASP-Umgebung erreichbar ist,
  nachdem der ASP-Anbieter den Zugriff freigeschaltet hat.

  Es wird NUR GELESEN – nichts veraendert.

  ------------------------------------------------------------------
  WAS DU VORHER VOM ASP-ANBIETER BRAUCHST:
    1. Die genaue Adresse (Host + Port), unter der DATEVconnect jetzt von
       aussen erreichbar ist. Beispiel:
         https://datev.mein-asp-anbieter.de:58452/datev/api
       (NICHT mehr "localhost" – das galt nur auf dem ASP-Server selbst.)
    2. Ob die Anmeldung ueber Windows-Login (SSO) oder ueber
       Benutzer+Passwort (Basic Auth) laeuft. Von aussen ist meist Basic Auth
       noetig – frag im Zweifel nach einem "technischen Benutzer" fuer
       DATEVconnect.
    3. Ob HTTPS mit einem gueltigen Zertifikat laeuft (dann ohne -Insecure)
       oder mit einem selbstsignierten (dann mit -Insecure zum Testen).

  ------------------------------------------------------------------
  AUFRUF-BEISPIELE (in PowerShell, kein Installieren noetig):

    # Basic Auth (fragt Benutzer/Passwort interaktiv ab):
    powershell -ExecutionPolicy Bypass -File .\datev-extern-test.ps1 `
      -BaseUrl "https://datev.mein-asp-anbieter.de:58452/datev/api" -Auth basic

    # Windows-SSO (falls der ASP das so eingerichtet hat):
    powershell -ExecutionPolicy Bypass -File .\datev-extern-test.ps1 `
      -BaseUrl "https://datev.mein-asp-anbieter.de:58452/datev/api" -Auth sso

    # Bei selbstsigniertem Zertifikat zusaetzlich -Insecure anhaengen (nur Test!)
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,                                  # z.B. https://host.asp.de:58452/datev/api

  [ValidateSet("sso", "basic")]
  [string]$Auth = "basic",                           # von aussen meist "basic"

  [string]$User,
  [string]$Pass,
  [switch]$Insecure                                  # nur fuer Test bei selbstsigniertem Zert.
)

$ErrorActionPreference = "Stop"
$ok   = "OK "
$fail = "FEHLGESCHLAGEN"

Write-Host ""
Write-Host "=== DATEVconnect Erreichbarkeitstest (von aussen) ===" -ForegroundColor Cyan
Write-Host "Basis-URL : $BaseUrl"
Write-Host "Auth      : $Auth"
Write-Host ""

# --- TLS 1.2 erzwingen (aeltere Windows-PowerShell nutzt sonst evtl. TLS 1.0) ---
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

# --- Zertifikatspruefung optional abschalten (nur bei -Insecure) ---
if ($Insecure) {
  if ($PSVersionTable.PSVersion.Major -ge 6) {
    $script:extra = @{ SkipCertificateCheck = $true }
  } else {
    # Windows PowerShell 5.1: Callback setzen
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    $script:extra = @{}
  }
  Write-Host "[Hinweis] Zertifikatspruefung ist ABGESCHALTET (-Insecure). Nur zum Testen!" -ForegroundColor Yellow
} else {
  $script:extra = @{}
}

# --- Header + Auth vorbereiten ---
$headers = @{ "Accept" = "application/json; charset=utf-8" }
$common  = @{}
if ($Auth -eq "basic") {
  if (-not $User) { $User = Read-Host "DATEVconnect-Benutzer" }
  if (-not $Pass) {
    $sec  = Read-Host "Passwort" -AsSecureString
    $Pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
              [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  }
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$User`:$Pass"))
  $headers["Authorization"] = "Basic $b64"
} else {
  $common["UseDefaultCredentials"] = $true          # Windows-SSO
}

# ============================================================
# Schritt 1: Ist der Host/Port ueberhaupt erreichbar? (TCP)
# ============================================================
try {
  $uri  = [System.Uri]$BaseUrl
  $vHost = $uri.Host
  $vPort = if ($uri.Port -gt 0) { $uri.Port } else { if ($uri.Scheme -eq "https") { 443 } else { 80 } }
  Write-Host ("1) TCP-Verbindung zu {0}:{1} ..." -f $vHost, $vPort) -NoNewline
  $tnc = Test-NetConnection -ComputerName $vHost -Port $vPort -WarningAction SilentlyContinue
  if ($tnc.TcpTestSucceeded) {
    Write-Host " $ok" -ForegroundColor Green
  } else {
    Write-Host " $fail" -ForegroundColor Red
    Write-Host "   -> Der Port ist von hier NICHT erreichbar. Moegliche Gruende:" -ForegroundColor Red
    Write-Host "      - Firewall/VPN nicht aktiv, oder ASP-Freischaltung greift fuer diese IP nicht"
    Write-Host "      - Falscher Host/Port (beim ASP-Anbieter rueckfragen)"
    Write-Host "   Test wird trotzdem fortgesetzt (evtl. blockt die Firewall nur den Ping-Teil)."
  }
} catch {
  Write-Host " (TCP-Vorpruefung uebersprungen: $($_.Exception.Message))" -ForegroundColor Yellow
}

# ============================================================
# Hilfsfunktion: GET mit sauberer Fehlerausgabe
# ============================================================
function Invoke-Datev($path) {
  try {
    return Invoke-RestMethod -Uri "$BaseUrl/$path" -Headers $headers @common @script:extra
  } catch {
    $status = $null; $body = $null
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch {}
    }
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $body = $_.ErrorDetails.Message }
    Write-Host " $fail" -ForegroundColor Red
    if ($status) { Write-Host ("   HTTP-Status: {0}" -f $status) -ForegroundColor Red }
    Write-Host ("   Meldung    : {0}" -f $_.Exception.Message) -ForegroundColor Red
    if ($body) { Write-Host ("   Antwort    : {0}" -f ($body.Substring(0,[Math]::Min(300,$body.Length)))) -ForegroundColor DarkYellow }

    # Haeufige Ursachen einordnen
    switch ($status) {
      401 { Write-Host "   -> 401: Anmeldung abgelehnt. Bei -Auth sso von aussen probier -Auth basic mit technischem Benutzer." -ForegroundColor Yellow }
      403 { Write-Host "   -> 403: Angemeldet, aber keine Rechte. Benutzer braucht 'DATEVconnect' + 'EO comfort connect' (ASP-Anbieter)." -ForegroundColor Yellow }
      406 { Write-Host "   -> 406: Accept-Header fehlt (sollte hier gesetzt sein) – bitte melden." -ForegroundColor Yellow }
      404 { Write-Host "   -> 404: Pfad/Port falsch. Basis-URL und Port pruefen." -ForegroundColor Yellow }
      default { Write-Host "   -> Wenn hier ein TLS-/Zertifikatsfehler steht: einmal mit -Insecure testen." -ForegroundColor Yellow }
    }
    throw
  }
}

# ============================================================
# Schritt 2..6: eigentliche API-Aufrufe (nur lesen)
# ============================================================
try {
  Write-Host "2) Identitaet (iam/v1/Users/me) ..." -NoNewline
  $me = Invoke-Datev "iam/v1/Users/me"
  Write-Host " $ok" -ForegroundColor Green
  $who = if ($me.userName) { $me.userName } elseif ($me.name) { $me.name } else { "(unbekannt)" }
  Write-Host "   Angemeldet als: $who"

  Write-Host "3) echo (Lebenszeichen) ..." -NoNewline
  Invoke-Datev "diagnostics/v1/echo" | Out-Null
  Write-Host " $ok" -ForegroundColor Green

  Write-Host "4) domains (installierte APIs) ..." -NoNewline
  $d = Invoke-Datev "diagnostics/v1/domains"
  Write-Host " $ok" -ForegroundColor Green
  Write-Host "   Verfuegbar: $($d.domains.name -join ', ')"

  Write-Host "5) ordertypes (Auftragsarten) ..." -NoNewline
  $ot = Invoke-Datev "order-management/v1/ordertypes"
  Write-Host " $ok ($($ot.Count) Stueck)" -ForegroundColor Green

  Write-Host "6) orders (nur erste 5, gefiltert auf 1 Jahr) ..." -NoNewline
  # Bewusst gefiltert, damit nicht der Gesamtbestand (~7500) gezogen wird:
  $jahr = (Get-Date).Year
  $o = Invoke-Datev "order-management/v1/orders?filter=creation_year eq $jahr"
  Write-Host " $ok ($($o.Count) im Jahr $jahr)" -ForegroundColor Green
  $o | Select-Object -First 5 id, order_number, ordertype, completion_status, billing_status | Format-Table -AutoSize

  Write-Host ""
  Write-Host "=== ERGEBNIS: Externer Zugriff funktioniert. Nur gelesen, nichts veraendert. ===" -ForegroundColor Green
  Write-Host ""
} catch {
  Write-Host ""
  Write-Host "=== ERGEBNIS: Externer Zugriff (noch) NICHT vollstaendig moeglich. Siehe Meldung oben. ===" -ForegroundColor Red
  Write-Host ""
  exit 1
}
