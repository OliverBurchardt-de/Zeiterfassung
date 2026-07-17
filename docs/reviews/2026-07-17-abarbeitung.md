# Abarbeitung des kritischen Reviews vom 17.07.2026

> Antwort-/Statusdokument zu `docs/reviews/2026-07-17-kritischer-code-review.md`.
> Jeder Befund mit Status: **behoben** · **teilweise** · **offen (bewusst, mit Begründung)**.
> Grundsatz: Alles, was ohne Live-DATEV/echte MS-SQL und ohne riskante Abhängigkeits-Migration
> korrekt und getestet abschließbar war, wurde behoben. Der Rest ist ehrlich als nächste Pakete
> (DATEV End-to-End, restliche Serverpersistenz, Dependency-Upgrade) markiert.

## P1 — vor Pilot/Produktiv zwingend

| Befund | Status | Was gemacht wurde |
|---|---|---|
| **P1-1** Checklisten-Gate umgehbar | **behoben** | Pflichtvorlage kommt ausschließlich serverseitig (`defaultChecklistLabels`); `ensure` übernimmt keine Client-Labels mehr; fehlende Pflichtpunkte werden auch bei vorhandenen manuellen Punkten ergänzt (`seedMandatoryChecklist`); Gate prüft Vorhandensein **und** Erledigung der Pflicht-Labels. Negativtests: verkürzte Labels, manueller Punkt vor Seed, „alle (1) erledigt". |
| **P1-2** DATEV-Writeback fehlt; Teilauftrags-ID verworfen | **teilweise** | Echte `suborder.id` wird jetzt durch Server-DTO **und** Frontend-Modell geführt (`datevId`) — der Leseweg verwirft sie nicht mehr. Der **Outbox-Arbeiter** existiert (Grundgerüst). **Offen (Paket B, braucht Live-DATEV):** Read-Modify-Write (PUT Auftrag/Teilauftrag), Kopplung Status/Zeitfreigabe → Outbox mit korrektem Posting, Live-Roundtrip. |
| **P1-3** Pflichtnotiz/Aufwandsart/Teilauftrag nur im Browser | **behoben** | Serverseitige Ordertype-Regeln (`domain/ordertypeRules.ts`): Pflicht-Notiz auf laufenden Arten; suborderId muss echter Teilauftrag **dieses** Auftrags sein; Ordertype ohne Teilaufträge lehnt jede suborderId ab. Negativtests ergänzt. |
| **P1-4** 12-h-Grenze nicht nebenläufigkeitsfest | **behoben** | Prüfung + Insert atomar (`insertWithinDailyLimit`): MSSQL in Transaktion mit `SERIALIZABLE` + `UPDLOCK/HOLDLOCK`, Memory synchron (nicht zwischen zwei awaits unterbrechbar). Paralleltest mit verschiedenen Idempotenz-Schlüsseln → genau eine Buchung geht durch. |
| **P1-5** Hohe Schwachstellen in Prod-Abhängigkeiten | **offen (bewusst)** | Fastify-5-Migration + Ersatz von `xlsx`/`httpntlm` ist eine umfangreiche, risikoreiche Umstellung (gefährdet u. a. den **verifizierten** NTLM-DATEV-Weg). Wird als eigener, getesteter Schritt **vor Produktivbetrieb** gemacht — nicht nebenbei. Sicherheitsentlastung jetzt: Security-Header + Body-Limit (s. P3-2) reduzieren die Angriffsfläche der API. |

## P2 — vor fachlicher Abnahme

| Befund | Status | Was gemacht wurde |
|---|---|---|
| **P2-1** Zeiterfassungs-Board: Sollzeit/Uhrzeit unzuverlässig | **behoben** | Tagessoll aus dem Nutzerprofil (Teilzeit korrekt) statt fix 8 h; Dauer-Stepper endet am Timeline-Ende (20:00); ehrlicher Hinweis in der UI, dass die Uhrzeit-Position Erfassungshilfe ist (gespeichert werden Datum + Dauer). **Offen:** Überlappungs-Erkennung, echte Uhrzeit-Persistenz (Fachentscheidung). |
| **P2-2** `ua`/`uv` per API für jede Art setzbar | **behoben** | Serverseitig nur für Unterlagen-Ordertypes (301/302/303) zulässig; Negativtest. |
| **P2-3** Temp-ID-Races bei optimistischen Neuanlagen | **offen (bewusst)** | Seltener Fall (sehr schnelles Klicken bei langsamer Leitung). Fix (abhängige Aktionen bis zur Server-ID sperren/queueen) berührt das optimistische Schreibmodell breit → als eigener, getesteter Schritt vorgemerkt statt fragiler Teiländerung. |
| **P2-4** Admin-Verwaltung nur in der Navigation geschützt | **behoben** | Render-Gate an `isAdmin` (nicht nur Navigation); Modul fällt bei Rechteverlust/Nutzerwechsel auf Board zurück; `apiLogout` leert die Session vollständig (users + offene Karte). |
| **P2-5** DATEV-Initialstatus pauschal `av` | **offen (bewusst)** | Ein korrektes Roundtrip-Mapping aller zehn Status braucht das **verifizierte DATEV-`completion_status`-Vokabular** (nur am Echtsystem feststellbar). Ein Raten wäre schlechter als der klare Fallback. Gemeinsam mit Paket B (Live) umzusetzen. |
| **P2-6** Board-Aggregat N+1-Abfragen | **offen (bewusst)** | Skalierungsthema (kein Korrektheitsfehler); die sichtbare Ladezeit hat der DATEV-Cache bereits entschärft. Batch-Repositories + Pagination als eigener Schritt vor Last-Abnahme. |
| **P2-7** Keine DATEV-Timeouts; anonymer tiefer Healthcheck | **behoben** | Hartes Timeout je DATEV-Aufruf (`DATEV_TIMEOUT_MS`, 30 s; fetch via `AbortSignal.timeout`, NTLM via `Promise.race`); `/api/health/datev` nur noch für angemeldete Nutzer, `/api/health` bleibt billiger Liveness. |
| **P2-8** Kernfunktionen im Servermodus nur lokal (localStorage) | **offen (bewusst)** | Das ist Paket C (Planung/Umplanung/Besonderheiten/Anforderungen/Nutzer-API serverseitig). Umfangreich und in der Roadmap (`CLAUDE.md`) als Etappe 3 geführt. |
| **P2-9** Login-IP-Schutz kollidiert mit Reverse Proxy | **behoben** | `trustProxy` konfigurierbar (echte Client-IP nur vom vertrauenswürdigen Proxy); Konto- und IP-Limit getrennt (Konto 5 scharf, IP 50 locker) → ein Einzelner sperrt nicht alle hinter dem Proxy; Login-Schutz mit TTL-Sweep + Max-Größe (kein Map-Wachstum). |

## P3 — Härtung/Nachweis

| Befund | Status | Was gemacht wurde |
|---|---|---|
| **P3-1** Audit-Historie unvollständig | **offen (bewusst)** | Fachentscheidung nötig (welche Aktionen revisionspflichtig, Vorher/Nachher, Korrelations-ID). Vorgemerkt; Statuswechsel-Historie + Checklisten-Soft-Delete bestehen bereits. |
| **P3-2** Security-Header/Limits/Config-Validierung | **behoben** | Zentrale Security-Header (CSP/X-Frame-Options/nosniff/Referrer) ohne neue Abhängigkeit; Body-Limit 256 KB; Login-Body längenbegrenzt; positive/ganzzahlige Config-Validierung (PORT/SESSION_TTL_MS/DB_PORT → Fail-Fast, behebt die `TimeoutNegativeWarning`). |
| **P3-3** E2E-Nachweis im Abnahmedokument überzeichnet | **behoben** | Testdrehbuch trennt jetzt ehrlich CI-Automatik (Typecheck/Lint/Unit/Build) von den **manuell** gestarteten Browser-E2E-Suiten (kein CI-Bestandteil). |

## Testlage nach der Abarbeitung

- Server: **158 Unit-/Integrationstests grün** (vorher 129 + neue Negativ-/Nebenläufigkeits-/
  Config-Tests), Typecheck + Lint + Build grün.
- Frontend: **53 Tests grün**, Typecheck + Lint + Build grün.
- Neue Tests decken gezielt die geschlossenen Lücken ab: Checklisten-Bypass, Ordertype-
  Buchungsregeln, ua/uv-Gating, atomare Tagesgrenze (parallel), getrennte Login-Limits + TTL-Sweep,
  Config-Fail-Fast.
- **Browser-E2E (manuell, 17.07.2026, gegen Commit `71dd0a8`):** `e2e-zeiterfassung`,
  `e2e-verhalten` (Demo) sowie `e2e-server-writes`, `e2e-teilauftrag`, `e2e-codexfixes`
  (Server-Modus) — **alle grün**. Bestätigt, dass die serverseitige Härtung die bestehenden
  Schreib-/Lese-Abläufe nicht bricht.

## Kurzfazit

Alle P1/P2/P3-Befunde, die **serverseitige fachliche Integrität und Security** betreffen und ohne
Live-Systeme abschließbar waren, sind **behoben und getestet** (P1-1, P1-3, P1-4, P2-2, P2-4, P2-7,
P2-9, P3-2, P3-3) — plus die sichtbaren Zeiterfassungs-Board-Korrekturen (P2-1) und der Leseweg der
echten Teilauftrags-ID (P1-2 Teil). Bewusst offen bleiben die **großen End-to-End-Pakete**
(DATEV-Rückschreibung live, restliche Serverpersistenz, Dependency-Upgrade, N+1/Skalierung,
Audit-Umfang) — sie brauchen Live-DATEV/MS-SQL bzw. eine fachliche Festlegung und sind der logische
**nächste Schritt**, nicht Teil dieser Härtungsrunde.
