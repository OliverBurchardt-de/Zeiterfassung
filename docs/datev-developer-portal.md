# DATEV Developer Portal — Rechercheergebnisse (für M2)

> Stand der Recherche: **24. Juni 2026**, Quelle: <https://developer.datev.de/>.
> Hinweis: Das Portal liefert auf maschinelle Abrufe **HTTP 403** (Bot-Schutz); die
> Detailseiten ließen sich nicht direkt einlesen. Die folgenden Angaben stammen aus der
> **DATEV-Such-/Portalindexierung** und sind mit den **im Repo liegenden OpenAPI-Specs**
> gegengeprüft (diese sind die maßgebliche, offline vorliegende Quelle). Punkte ohne
> Spec-Beleg sind als **(verifizieren)** markiert und vor der Umsetzung im eingeloggten
> Portal bzw. gegen die Live-Instanz zu bestätigen.

---

## 1. Zwei Integrationswege — der Kern für unsere Architektur

DATEV bietet zwei technisch getrennte Wege, an dieselben Fachdaten zu kommen:

| | **DATEVconnect (On-Premise / „Desktop-APIs")** | **Cloud API-Gateway („Online-APIs")** |
|---|---|---|
| Lage | Lokaler Dienst im Kanzleinetz | DATEV-Cloud (zentrales Gateway) |
| Endpunkt | `http://localhost:58454/...` (HTTP), `:58452` (HTTPS) | `https://api.datev.de/...` (verifizieren) |
| Auth | **Basic Auth** (Windows-Benutzer mit DATEV-Rechten) | **OAuth 2.0 / OpenID Connect** (App mit Client-ID/Secret) |
| Onboarding | DATEVconnect-Lizenz + lokale Installation | App-Registrierung im Portal + Tech-Review |
| Unsere Specs | **Order Management 1.4.9**, Client Master Data, Accounting, Diagnostics (alle im Repo-Root) | separater Produktkatalog im Portal |

**Belegt:** Die Spec `Diagnostics and Functional Tests-1.1.2.json` führt explizit
`server: http://localhost:58454/datev/api/diagnostics/v1` und `securitySchemes.basicAuth`
(`type: http`, `scheme: basic`). Das bestätigt den On-Premise-Basic-Auth-Weg, auf dem unser
M2-Plan aufsetzt.

**Konsequenz für uns:** Unser geplanter Weg (On-Premise DATEVconnect, Basic Auth, Lesen +
Rückschreiben nach EO Comfort) bleibt gültig und ist der direktere für eine On-Prem-App im
Kanzleinetz. Der Cloud-Gateway-Weg ist die strategische Alternative/Zukunft (siehe §5) und für
einen späteren SaaS-/Remote-Betrieb relevant.

---

## 2. Onboarding (Cloud-Weg) — Schritt für Schritt

1. **App anlegen** im Organisations-Dashboard → erhält **Client-ID** und **Client-Secret**.
2. **Organisation verknüpfen**: als bestehender DATEV-Geschäftspartner über die
   **Beraternummer**; ohne Beraternummer wird im Prozess ein neuer Geschäftspartner angelegt.
   Als **DATEV-Marktplatz-Partner** ist keine separate Registrierung nötig; **Nicht-Partner**
   nutzen ein eigenes Registrierungsformular (DATEV hat den Zugang für Nicht-Partner geöffnet).
3. **Produkte abonnieren**: Die App abonniert die benötigten API-Produkte → damit
   Autorisierung zur Integration.
4. **Sandbox-Entwicklung**: Für **jede Online-API** steht eine **Sandbox** bereit; dort
   gegen Testdaten entwickeln.
5. **Produktivschaltung**: Die App muss einen **Technical Review** (Schnittstellen-/Branding-
   Vorgaben) erfolgreich durchlaufen, bevor sie auf Produktion gehen darf.

*(Quelle: Portal-Hilfe & „Guides – Authentication / Interface requirements"; verifizieren.)*

---

## 3. Authentifizierung

- **Cloud:** OAuth 2.0 + OpenID Connect; App-Credentials (Client-ID/Secret), Scopes je
  abonniertem Produkt, Token-basiert. Zusätzliches Angebot **„Login mit DATEV"** (SSO für
  Endnutzer) — für uns nur relevant, falls wir DATEV-Identitäten zum App-Login nutzen wollen
  (unser M2-Plan sieht **eigenen Login** vor, also optional).
- **On-Premise (unser Weg):** **Basic Auth** mit einem Windows-Konto, das mit einem
  DATEV-Benutzer mit passenden Rechten auf die Organisation/den Bereich verknüpft ist. Dienst
  **„LocalAPIService"** muss laufen; korrekter Port (HTTP `58454` vs. HTTPS `58452`) ist
  zwingend, sonst kommen leere Antworten.

---

## 4. Für das Projekt relevante API-Produkte (im Repo bereits als Spec vorhanden)

| Produkt | Zweck im Projekt | Spec im Repo (`docs/specs/`) |
|---|---|---|
| **Order Management 1.4.9** | Aufträge lesen + Status/Plandaten/Verantwortliche zurückschreiben | `Order Management-1.4.9.json` |
| **Client Master Data 1.7.1** | Mandanten-/Mitarbeiter-Stammdaten (`client_id` → Mandant) | `Client Master Data-1.7.1.json` |
| **Diagnostics and Functional Tests 1.1.2** | DATEVconnect-Verfügbarkeit prüfen (Health-Check) | `Diagnostics and Functional Tests-1.1.2.json` |
| Accounting / Accounting Data Exchange / DXSO-Jobs / Documents | Buchhaltung/Belege (perspektivisch Abrechnungs-/Faktura-Status, Aufwandsbuchungen) | `Accounting-*.json`, `accounting_*.json` |

Details zum Feld-Mapping, Status-Mapping, Teilaufträgen und Rückschreibung stehen in
**`docs/datev-integration.md`** (aus den Specs abgeleitet) — dieses Dokument ergänzt nur die
**Portal-/Onboarding-Ebene**.

---

## 5. API-Gateway-Migration (Cloud) — Zeitleiste & Einordnung

- Migration bestehender Cloud-Integrationen auf das **neue API-Gateway**: Start **03.04.2023**,
  Abschluss/Abnahme bis **31.03.2024**; ab **01.04.2024** ist für Cloud-Integrationen **nur noch
  das neue Gateway** verfügbar.
- Parallel werden die **Desktop-APIs (DATEVconnect)** weiter gepflegt und erweitert (Portal-News
  „New Desktop APIs online"; z. B. Payroll-Desktop-API v3.1.4). Der On-Premise-Weg ist also
  **nicht abgekündigt**.
- **Einordnung:** Für unsere On-Prem-Kanzlei-App ist die Gateway-Migration **derzeit nicht
  blockierend** (betrifft den Cloud-Weg). Falls die App später remote/zentral betrieben werden
  soll, ist der Gateway-Weg (OAuth2, Tech-Review, Branding) einzuplanen. **(Termine/Details vor
  M2-Architekturentscheid im eingeloggten Portal verifizieren.)**

---

## 6. Schnittstellen- & Branding-Vorgaben (für Produktivschaltung Cloud)

Die „**Schnittstellenvorgaben / Interface requirements**" definieren Pflichten für UI, Logo-/
Namensnutzung, „Login mit DATEV"-Darstellung und technisches Verhalten, die im **Technical
Review** geprüft werden. Relevant **nur für den Cloud-Weg** bzw. eine offizielle Marktplatz-
Listung — für eine rein interne On-Prem-Nutzung im Kanzleinetz nachrangig, aber bei späterer
Veröffentlichung zu beachten. **(Inhalte im Portal einsehen, sobald eingeloggt.)**

---

## 7. Wichtige Links

| Thema | URL |
|---|---|
| Portal-Start | <https://developer.datev.de/de/> |
| Alle API-Produkte | <https://developer.datev.de/en/products> |
| Order Management — Überblick | <https://developer.datev.de/de/product-detail/order-management/1.4.9/overview> |
| Order Management — Dokumentation | <https://developer.datev.de/de/product-detail/order-management/1.4.9/documentation> |
| Order Management — Referenz | <https://developer.datev.de/de/product-detail/order-management/1.4.9/reference> |
| Authentifizierung (Guide) | <https://developer.datev.de/en/guides/authentication> |
| Schnittstellenvorgaben (Guide) | <https://developer.datev.de/de/guides/interface-requirements> |
| API-Gateway-Migration | <https://developer.datev.de/datev/platform/en/api-migration-kooperationspartner> |
| Login mit DATEV | <https://developer.datev.de/en/resources/login-mit-datev> |
| Hilfe & Kontakt | <https://developer.datev.de/de/help> |
| News (Desktop-APIs etc.) | <https://developer.datev.de/en/news> |

---

## 8. Offene, vor M2 zu verifizierende Punkte

1. **Cloud vs. On-Premise final festlegen** — wir planen On-Premise (Basic Auth); bestätigen,
   dass Order Management dort alle benötigten GET/PUT-Operationen abdeckt (Specs deuten darauf).
2. **Genaue Cloud-Endpunkt-Basis-URL** und Scopes je Produkt (verifizieren).
3. **DATEVconnect-Lizenz/Module** der Kanzlei: Welche APIs sind freigeschaltet? (Abruf von
   Buchungen ist teils **kostenpflichtige Zusatzfunktion** mit eigener Lizenz.)
4. **Zeit-Rückschreibung** (feingranular) — kein Schreib-Endpunkt für Einzelzeiten bekannt
   (siehe `docs/datev-integration.md`); gegen Live-Instanz prüfen.
5. **Health-Check** über die Diagnostics-API in den Adapter aufnehmen (Verfügbarkeit/Login).
