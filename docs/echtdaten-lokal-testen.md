# Echtdaten lokal ansehen — Schritt für Schritt

> Ziel: die **echten DATEV-Aufträge** der Kanzlei einmal in der App auf dem Board sehen.
> Das läuft auf **deinem Kanzlei-PC**, während die gewohnte Verbindung ins ASP aktiv ist
> (dieselbe, über die wir in der PowerShell getestet haben).
>
> **Ungefährlich:** Die App **liest nur** aus DATEV. Zeitbuchungen, Statuswechsel usw. landen
> bei diesem Test nur im Arbeitsspeicher deines PCs — es wird **nichts** nach DATEV zurückgeschrieben.

---

## Voraussetzungen (einmalig)

- Die Verbindung ins ASP ist aktiv (wie beim PowerShell-Test am Freitag).
- **Node.js** ist installiert (`node --version` in PowerShell zeigt eine Versionsnummer).
- Das Projekt liegt lokal, z. B. unter `C:\Projekte\Zeiterfassung`.

---

## Schritt 1 — Projekt aktualisieren (PowerShell)

```powershell
cd C:\Projekte\Zeiterfassung
git pull origin main
npm install
cd server
npm install
cd ..
```

## Schritt 2 — Die Datei `server\.env` anlegen

Das ist der einzige „echte" Konfigurationsschritt. Lege im Ordner `server` eine Datei namens
**`.env`** an (z. B. `notepad server\.env`) mit diesem Inhalt:

```
DATEV_MODE=http
DATEV_BASE_URL=https://HIER-DIE-ADRESSE:58452/datev/api
DATEV_AUTH=ntlm
DATEV_USER=DOMAENE\dein-windows-benutzer
DATEV_PASSWORD=dein-windows-passwort
DATEV_TLS_INSECURE=true
DATEV_ORDERS_FILTER=creation_year eq 2026
DB_MODE=memory
```

Hinweise:

- **`DATEV_BASE_URL`** — exakt die Adresse, die beim PowerShell-Test als `-BaseUrl` funktioniert
  hat (mit `/datev/api` am Ende, Port `58452` für HTTPS).
- **`DATEV_USER` / `DATEV_PASSWORD`** — dieselbe Windows-Anmeldung wie im PowerShell-Test
  (`DOMÄNE\benutzer`).
- **`DATEV_ORDERS_FILTER=creation_year eq 2026`** holt nur die Aufträge aus 2026 (sonst kämen
  ~7.500 auf einmal). Zum Ausprobieren anderer Jahre einfach die Zahl ändern und den Server
  neu starten.
- **Die `.env` bleibt nur auf deinem PC** — sie ist von Git ausgeschlossen (`.gitignore`) und
  landet nie im Repo. Trotzdem: keine Passwörter woandershin kopieren.

## Schritt 3 (optional, empfohlen) — Vorflug-Check ohne die App

Bevor die App startet, prüft dieses read-only Skript separat, ob Verbindung + Anmeldung stehen —
so lässt sich ein Netz-/Anmeldeproblem von einem App-Problem trennen:

```powershell
powershell -ExecutionPolicy Bypass -File .\docs\datev-extern-test.ps1 `
  -BaseUrl "https://HIER-DIE-ADRESSE:58452/datev/api" -Auth ntlm -Insecure
```

Am Ende sollte stehen: **„Externer Zugriff funktioniert. Nur gelesen, nichts verändert."**
plus eine kleine Tabelle mit den ersten 5 echten Aufträgen. Wenn ja → weiter mit Schritt 4.

## Schritt 4 — Server starten (Terminal 1)

```powershell
cd C:\Projekte\Zeiterfassung\server
npm run dev
```

Beim Start zeigt das Fenster jetzt eine Zeile wie:

```
[DATEV] Modus http — https://…:58452/datev/api (Auth: ntlm)
[DATEV] erreichbar.
```

Steht dort **„erreichbar."**, ist die Verbindung zu DATEV in Ordnung. (Gegenprobe im Browser:
`http://localhost:3001/api/health/datev`.)

## Schritt 5 — App starten (Terminal 2, neues PowerShell-Fenster)

```powershell
cd C:\Projekte\Zeiterfassung
npm run dev:api
```

## Schritt 6 — Ansehen

Browser öffnen: **http://localhost:5173** → Anmelden als **`burchardt`** / Passwort **`demo`**
(der Demo-Admin sieht *alle* Aufträge) → **die echten DATEV-Aufträge auf dem Board.**

---

## Was du sehen wirst — und was (noch) nicht

**Da:** echte Auftragsnummern, Auftragsarten (FiBu, Jahresabschluss, Lohn …), Planstunden,
Fristen/Monate. Alle Aufträge starten in „Arbeitsvorrat" (den Board-Status verwaltet unsere App,
nicht DATEV). Klicken, Zeiten buchen, Status ziehen ist möglich — alles nur lokal im Speicher.

**Zwei bekannte Lücken (normal, nächste Ausbauschritte):**

1. **Die Mandanten-Spalte zeigt die DATEV-interne ID** statt „Hotel Seeblick KG" — der
   Namens-Abruf aus den Mandanten-Stammdaten ist der logische nächste Schritt.
2. **Bearbeiter/Partner sind leer** — die Demo-Nutzer sind noch nicht mit euren echten
   DATEV-Mitarbeitern verknüpft (kommt mit der Nutzer-Verwaltung).

Beides ändert nichts daran, dass die echten Aufträge korrekt erscheinen.

---

## Falls etwas klemmt

| Symptom | Ursache / Lösung |
|---|---|
| Server-Log zeigt `[DATEV] NICHT erreichbar` oder Timeout | Verbindung/Firewall — läuft dieselbe Verbindung wie beim PowerShell-Test? Adresse und Port (`58452`) prüfen. |
| `401` im Server-Log | Benutzer als `DOMÄNE\benutzer` geschrieben? Passwort korrekt? Rechte „DATEVconnect" + „EO comfort connect" beim ASP-Anbieter vorhanden? |
| Zertifikatsfehler / TLS | `DATEV_TLS_INSECURE=true` in der `.env` (bei Zugriff über IP nötig, nur für den Test). |
| Board leer nach Login | Als `burchardt` angemeldet (Admin sieht alles)? Filter-Jahr in `DATEV_ORDERS_FILTER` passend zu vorhandenen Aufträgen? |
| Server startet nicht: „DATEV_USER und DATEV_PASSWORD…" | Zugangsdaten fehlen in der `.env`. |
| `npm run dev` meldet „port in use" | Läuft schon ein Server auf 3001? Altes Fenster schließen. |

Wenn eine Fehlermeldung auftaucht: die letzten Zeilen aus dem Server-Fenster kopieren — daran
lässt sich die Ursache in der Regel sofort erkennen.

---

## Verbindung wieder auf „normal" (Demo) stellen

Für den gewohnten Demo-Betrieb ohne DATEV einfach die Datei `server\.env` löschen oder umbenennen
und die App wie üblich mit `npm run dev` (statt `dev:api`) starten. Ohne `.env` läuft der Server
automatisch wieder im Schein-Modus.
