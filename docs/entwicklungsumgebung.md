# Entwicklungsumgebung (lokaler Rechner) — Einrichtung & Umzug in die Produktion

> **Festlegung (02.07.2026):** Entwickelt und getestet wird **lokal auf dem Kanzlei-PC**
> (volle Rechte, Installationen erlaubt). Der Zugriff auf **DATEVconnect** funktioniert von dort
> nachweislich über die VPN-Verbindung per **NTLM** (Windows-Login; verifiziert —
> `docs/datev-connect-handoff.md` §12). Die **Produktivumgebung** liegt später **im ASP** —
> der Umzug ist eine reine **Konfigurations-Frage** (siehe Checkliste unten), kein Code-Umbau.

---

## 1. Einmalige Installation (alles kostenlos, offizielle Quellen)

| Was | Wozu | Woher |
|---|---|---|
| **Node.js LTS** | Laufzeit für App + Server | nodejs.org → „LTS" (Windows Installer, Standard-Optionen) |
| **Git** | Projekt vom Repo holen/aktuell halten | git-scm.com (Standard-Optionen) |
| **SQL Server Express** | lokale Datenbank (wie später MS SQL im ASP) | microsoft.com → „SQL Server Express" → Installationstyp **„Standard"/Basic** |
| **SQL Server Management Studio (SSMS)** *(optional)* | Datenbank ansehen/verwalten | wird am Ende der Express-Installation mit angeboten |

**Nach der SQL-Express-Installation** (Basic-Setup) gilt:
- Instanzname: **`SQLEXPRESS`** (Verbindung: `localhost` + Instanz `SQLEXPRESS`).
- **SQL-Anmeldung aktivieren** (einmalig, für den App-Benutzer): In SSMS → Server-Eigenschaften →
  Sicherheit → **„SQL Server- und Windows-Authentifizierungsmodus"** wählen → SQL-Dienst neu starten.
- **Datenbank + Benutzer anlegen** (in SSMS, „Neue Abfrage", einmal ausführen):
  ```sql
  CREATE DATABASE Zeiterfassung;
  GO
  CREATE LOGIN zeiterfassung_app WITH PASSWORD = 'HIER-EIN-SICHERES-PASSWORT';
  GO
  USE Zeiterfassung;
  CREATE USER zeiterfassung_app FOR LOGIN zeiterfassung_app;
  ALTER ROLE db_owner ADD MEMBER zeiterfassung_app;
  ```

## 2. Projekt holen und starten

```powershell
# Projekt klonen (einmalig; danach reicht "git pull" im Projektordner)
git clone https://github.com/OliverBurchardt-de/Zeiterfassung.git
cd Zeiterfassung
git checkout claude/magical-gauss-3h604n

# Frontend
npm install
npm run dev          # -> http://localhost:5173 (Demo-Modus: Mock-Daten im Browser)
npm run dev:api      # -> Server-Modus: echter Login + Daten vom Server (Server muss laufen)

# Server (zweites PowerShell-Fenster)
cd server
npm install
copy .env.example .env    # und .env ausfuellen, s. Abschnitt 3
npm run db:setup          # legt Tabellen + ersten Admin an (einmalig)
npm run dev               # -> http://localhost:3001
```

## 3. Die lokale `.env` (server/.env — bleibt auf DEINEM Rechner, nie ins Repo)

```ini
NODE_ENV=development
COOKIE_SECRET=irgendein-langer-zufallswert

# --- Datenbank: lokales SQL Server Express ---
DB_MODE=mssql
DB_HOST=localhost
DB_INSTANCE=SQLEXPRESS
DB_NAME=Zeiterfassung
DB_USER=zeiterfassung_app
DB_PASSWORD=<das oben vergebene Passwort>

# --- Erster Admin (nur fuer den allerersten db:setup-Lauf noetig) ---
SETUP_ADMIN_USER=burchardt
SETUP_ADMIN_NAME=O. Burchardt
SETUP_ADMIN_EMAIL=<deine E-Mail>
SETUP_ADMIN_PASSWORD=<sicheres Passwort>

# --- DATEVconnect: von diesem PC aus per NTLM (VPN muss verbunden sein) ---
DATEV_MODE=http
DATEV_BASE_URL=https://<interne-IP-des-ASP-Servers>:58452/datev/api
DATEV_AUTH=ntlm
DATEV_USER=DOMAENE\Benutzer          # Windows-/RDP-Anmeldung
DATEV_PASSWORD=<Windows-Passwort>
DATEV_TLS_INSECURE=true              # noetig bei Zugriff ueber IP (nur Entwicklung!)
DATEV_ORDERS_FILTER=creation_year eq 2026
```

> Solange du **ohne** Datenbank/DATEV arbeiten willst: `DB_MODE=memory` und `DATEV_MODE=mock`
> lassen — dann läuft alles mit Demo-Daten (Login `burchardt`, Passwort `demo`).

## 4. Prüfen, dass alles läuft

1. `http://localhost:3001/api/health` im Browser → `{"status":"ok"}`.
2. `http://localhost:3001/api/health/datev` → zeigt, ob DATEVconnect erreichbar ist
   (VPN verbunden?).
3. Frontend `http://localhost:5173` → Login.
   Im **Server-Modus** (`npm run dev:api`) ist das der echte Login: Benutzername + Passwort
   werden serverseitig gegen die Datenbank geprüft (der erste Admin kommt aus `db:setup`);
   das Board zeigt die Aufträge vom Server (Etappe 1: Lesen; Schreib-Aktionen folgen).

---

## 5. Umzug Entwicklung → Produktion (ASP) — Checkliste

Der Code bleibt **identisch**; es ändert sich nur die `.env` auf dem Zielserver. Das ist von
Anfang an so gebaut (alle Umgebungs-Unterschiede stecken in Konfiguration, nicht im Code):

| Einstellung | Entwicklung (dein PC) | Produktion (ASP) |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `COOKIE_SECRET` | beliebig | **neuer, langer Zufallswert** (Pflicht — Fail-Fast) |
| `DB_HOST`/`DB_INSTANCE` | `localhost` + `SQLEXPRESS` | ASP-SQL-Server (eigene DB + SQL-Benutzer) |
| `DATEV_BASE_URL` | `https://<IP>:58452/...` (VPN) | `http://localhost:58454/...` (gleicher Server) |
| `DATEV_AUTH` | `ntlm` (dein Windows-Login) | `basic` (**technischer Benutzer**, beim ASP anfragen) |
| `DATEV_TLS_INSECURE` | `true` (IP-Zugriff) | `false` (**in Produktion verboten** — Fail-Fast) |

**Ablauf des Umzugs:**
1. ASP-Anbieter liefert: Server/VM, eigene DB + SQL-Benutzer, technischen DATEV-Benutzer
   (Anfragen liegen bereit: `docs/datev-asp-anfrage.md`, `docs/datev-asp-anfrage-externer-zugriff.md`).
2. Node.js LTS auf dem Zielserver (einzige Installations-Voraussetzung — alle Pakete sind
   **reines JavaScript**, nichts muss kompiliert werden; bewusste Entscheidungen ADR-04/ADR-07).
3. Projekt aufspielen, `npm ci`, Produktions-`.env` setzen.
4. `npm run db:setup` gegen die ASP-Datenbank (Schema ist idempotent; legt dort den ersten
   Admin an).
5. Frontend bauen (`npm run build`) und ausliefern; Server als Windows-Dienst einrichten
   (Details im Deployment-Kapitel, `docs/architektur.md`).
6. Smoke-Test: `/api/health`, `/api/health/datev`, Login.

**Warum das sicher klappt:** Dieselbe Datenbank-Technik (MS SQL hier wie dort), derselbe
DATEV-Adapter (nur anderer Anmeldeweg per Konfiguration), keine nativen Abhängigkeiten,
Schema idempotent. Der Umzug ist Punkt-für-Punkt durchspielbar, bevor er stattfindet.
