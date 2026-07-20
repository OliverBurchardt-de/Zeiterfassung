<#
  DATEVconnect - Erreichbarkeitstest VON AUSSERHALB des ASP
  =========================================================
  Zweck: Pruefen, ob DATEVconnect (Order Management etc.) jetzt auch aus dem
  Kanzleinetz / von einem PC ausserhalb der ASP-Umgebung erreichbar ist,
  nachdem der ASP-Anbieter den Zugriff freigeschaltet hat.

  Es wird NUR GELESEN - nichts veraendert.

  ------------------------------------------------------------------
  WAS DU VORHER VOM ASP-ANBIETER BRAUCHST:
    1. Die genaue Adresse (Host + Port), unter der DATEVconnect jetzt von
       aussen erreichbar ist. Beispiel:
         https://<HOST>:<PORT>/datev/api
       (NICHT "localhost" - das galt nur auf dem ASP-Server selbst.)
    2. Welche Anmeldung von aussen gilt:
         -Auth ntlm   Windows-Domaenenkonto "DOMAIN\benutzer" + Windows-Passwort
                      (VERIFIZIERT als der funktionierende Weg von aussen, wenn
                      Anwender per SmartLogin/2FA angemeldet sind)
         -Auth basic  DATEV-Techniknutzer + festes Kennwort (fuer Dauerbetrieb;
                      Basic mit E-Mail/SmartLogin funktioniert NICHT)
         -Auth sso    integrierte Windows-Anmeldung (nur auf dem ASP-Server sinnvoll)
    3. Ob HTTPS mit gueltigem Zertifikat laeuft (dann ohne -Insecure) oder
       mit selbstsigniertem/IP-Adresse (dann mit -Insecure zum Testen).

  ------------------------------------------------------------------
  AUFRUF-BEISPIELE (in PowerShell, kein Installieren noetig):

    powershell -ExecutionPolicy Bypass -File .\datev-extern-test.ps1 -BaseUrl "https://<HOST>:<PORT>/datev/api" -Auth basic -Insecure

    # Windows-SSO statt Basic Auth:
    powershell -ExecutionPolicy Bypass -File .\datev-extern-test.ps1 -BaseUrl "https://<HOST>:<PORT>/datev/api" -Auth sso -Insecure
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,

  [ValidateSet("ntlm", "basic", "sso")]
  [string]$Auth = "ntlm",

  [string]$User,
  [string]$Pass,
  [switch]$Insecure
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== DATEVconnect Erreichbarkeitstest (von aussen) ==="
Write-Host "Basis-URL : $BaseUrl"
Write-Host "Auth      : $Auth"
Write-Host ""

# --- TLS 1.2 erzwingen (aeltere Windows-PowerShell nutzt sonst evtl. TLS 1.0) ---
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

# --- Ein einziges Parameter-Set fuer alle Aufrufe zusammenbauen ---
$headers = @{ "Accept" = "application/json; charset=utf-8" }
$common  = @{ Headers = $headers }

if ($Auth -eq "sso") {
  $common["UseDefaultCredentials"] = $true
} else {
  # ntlm oder basic: Benutzer + Passwort einsammeln
  if (-not $User) {
    $hint = if ($Auth -eq "ntlm") { 'Windows-Benutzer (z.B. DOMAIN\benutzer)' } else { 'DATEVconnect-Benutzer' }
    $User = Read-Host $hint
  }
  if (-not $Pass) {
    $sec  = Read-Host "Passwort" -AsSecureString
    $Pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
              [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  }
  if ($Auth -eq "ntlm") {
    # NTLM: Aushandlung ueber -Credential (Server antwortet mit 401 + NTLM-Challenge)
    $secpw = ConvertTo-SecureString $Pass -AsPlainText -Force
    $common["Credential"] = New-Object System.Management.Automation.PSCredential($User, $secpw)
  } else {
    # Basic: Header preemptiv setzen
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${User}:${Pass}"))
    $headers["Authorization"] = "Basic $b64"
  }
}

# --- Zertifikatspruefung optional abschalten (nur bei -Insecure) ---
if ($Insecure) {
  if ($PSVersionTable.PSVersion.Major -ge 6) {
    $common["SkipCertificateCheck"] = $true
  } else {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
  }
  Write-Host "[Hinweis] Zertifikatspruefung ist ABGESCHALTET (-Insecure). Nur zum Testen!"
}

# ============================================================
# Schritt 1: Ist der Host/Port ueberhaupt erreichbar? (TCP)
# ============================================================
try {
  $uri   = [System.Uri]$BaseUrl
  $vHost = $uri.Host
  $vPort = if ($uri.Port -gt 0) { $uri.Port } elseif ($uri.Scheme -eq "https") { 443 } else { 80 }
  Write-Host ("1) TCP-Verbindung zu {0}:{1} ..." -f $vHost, $vPort) -NoNewline
  $tnc = Test-NetConnection -ComputerName $vHost -Port $vPort -WarningAction SilentlyContinue
  if ($tnc.TcpTestSucceeded) {
    Write-Host " OK"
  } else {
    Write-Host " FEHLGESCHLAGEN"
    Write-Host "   -> Port von hier NICHT erreichbar. Firewall/VPN pruefen oder Adresse/Port beim ASP-Anbieter rueckfragen."
    Write-Host "   Test wird trotzdem fortgesetzt."
  }
} catch {
  Write-Host " (TCP-Vorpruefung uebersprungen: $($_.Exception.Message))"
}

# ============================================================
# Hilfsfunktion: GET mit sauberer Fehlerausgabe
# ============================================================
function Invoke-Datev($path) {
  try {
    return Invoke-RestMethod -Uri "$BaseUrl/$path" @common
  } catch {
    $status = $null
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch {}
    }
    Write-Host " FEHLGESCHLAGEN"
    if ($status) { Write-Host ("   HTTP-Status: {0}" -f $status) }
    Write-Host ("   Meldung    : {0}" -f $_.Exception.Message)
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $b = $_.ErrorDetails.Message
      Write-Host ("   Antwort    : {0}" -f ($b.Substring(0, [Math]::Min(300, $b.Length))))
    }
    if     ($status -eq 401) { Write-Host "   -> 401: Anmeldung abgelehnt. Bei -Auth sso mal -Auth basic mit technischem Benutzer probieren." }
    elseif ($status -eq 403) { Write-Host "   -> 403: Angemeldet, aber keine Rechte ('DATEVconnect' + 'EO comfort connect' beim ASP-Anbieter)." }
    elseif ($status -eq 406) { Write-Host "   -> 406: Accept-Header fehlt (sollte hier gesetzt sein) - bitte melden." }
    elseif ($status -eq 404) { Write-Host "   -> 404: Pfad/Port falsch. Basis-URL und Port pruefen." }
    else                     { Write-Host "   -> Steht hier ein TLS-/Zertifikatsfehler: einmal mit -Insecure testen." }
    throw
  }
}

# ============================================================
# Schritt 2..6: eigentliche API-Aufrufe (nur lesen)
# ============================================================
try {
  Write-Host "2) Identitaet (iam/v1/Users/me) ..." -NoNewline
  $me = Invoke-Datev "iam/v1/Users/me"
  Write-Host " OK"
  $who = if ($me.userName) { $me.userName } elseif ($me.name) { $me.name } else { "(unbekannt)" }
  Write-Host "   Angemeldet als: $who"

  Write-Host "3) echo (Lebenszeichen) ..." -NoNewline
  Invoke-Datev "diagnostics/v1/echo" | Out-Null
  Write-Host " OK"

  Write-Host "4) domains (installierte APIs) ..." -NoNewline
  $d = Invoke-Datev "diagnostics/v1/domains"
  Write-Host " OK"
  Write-Host "   Verfuegbar: $($d.domains.name -join ', ')"

  Write-Host "5) ordertypes (Auftragsarten) ..." -NoNewline
  $ot = Invoke-Datev "order-management/v1/ordertypes"
  Write-Host (" OK ({0} Stueck)" -f $ot.Count)

  Write-Host "6) orders (gefiltert auf aktuelles Jahr, erste 5) ..." -NoNewline
  $jahr = (Get-Date).Year
  $o = Invoke-Datev "order-management/v1/orders?filter=creation_year eq $jahr"
  Write-Host (" OK ({0} im Jahr {1})" -f $o.Count, $jahr)
  $o | Select-Object -First 5 id, order_number, ordertype, completion_status, billing_status | Format-Table -AutoSize

  Write-Host ""
  Write-Host "=== ERGEBNIS: Externer Zugriff funktioniert. Nur gelesen, nichts veraendert. ==="
  Write-Host ""
} catch {
  Write-Host ""
  Write-Host "=== ERGEBNIS: Externer Zugriff (noch) NICHT vollstaendig moeglich. Siehe Meldung oben. ==="
  Write-Host ""
  exit 1
}
