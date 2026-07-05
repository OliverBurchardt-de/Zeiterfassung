# Gesamtreview 29.06.2026 — Code, Datenmodell, UI, Funktionen (+ Abarbeitung)

> Anlass: Review-Auftrag nach M2-Backend-Start. Vorgehen: drei unabhängige Prüf-Agenten
> (Frontend-Code, Server-Code, Datenmodell-Konsistenz) + eigener UI-Durchlauf (Playwright,
> beide Rollen, alle Module) + Qualitäts-Gates. Alle Befunde wurden **am selben Tag abgearbeitet**
> (Commit-Referenz siehe Git-Historie); Status je Befund unten.

## UI-Durchlauf
Alle Module in beiden Rollen: **0 Konsolenfehler**, Navigation/Rollen-Gating korrekt,
Optik konsistent (Screenshots geprüft). Keine Darstellungsfehler.

## Befunde und Abarbeitung

### Hoch
| # | Befund | Fix |
|---|---|---|
| H1 | **Reload verliert Rolle/Admin**: `partialize` persistierte `currentUserId`, aber nicht `role`/`isAdmin` → Partner nach Reload faktisch Mitarbeiter | ✅ `merge`-Hook leitet Rolle/Admin beim Laden aus dem Nutzer ab; deaktivierte Nutzer werden abgemeldet (Store `version` 11) |
| H2 | **JA/ESt-Kontingent falsch verbraucht**: Erstplanung über das Modal und „Umplanen" ohne Monatswechsel zählten +1; „Pool und neu ziehen" setzte den Zähler zurück (Freigabe-Umgehung) | ✅ `umplanen` mit Store-Guard (Erstplanung/No-Op zählen nicht; Sperre greift); `unplanOrder` für Mitarbeiter mit `kontingentVerbrauchen`; PlanungView nutzt `rolePolicy`, Partner/Admin verschieben `erzwungen` (zählt wie Freigabe) |
| H3 | **Server: Partner sah ALLE Mandate** (großzügiger als Frontend/Spez.); `OrderView` hatte kein Partner-Feld | ✅ `visibleOrders` filtert Partner auf eigene Mandate (`partnerId`/`responsibleId`); `OrderView` um `partnerId`, `billingStatus`, `creationYear` ergänzt (+ id-Konvertierungs-Konvention dokumentiert) |
| H4 | **Besonderheiten-Schlüssel inkonsistent**: Frontend `mandantNr+artKey` (Bucket) vs. DB/Docs `clientId+ordertype`; DB erlaubte nur einen Eintrag je Schlüssel, Frontend führt Liste | ✅ Frontend-`besKey` auf `ordertype` umgestellt (Mock-Keys migriert); Prisma-`Besonderheit` als Liste (Autor/Datum, Index statt `@@unique`); CLAUDE.md angepasst |
| H5 | **Checklisten-Instanzen ohne DB-Heimat** (Kernregel „Erledigt erst bei vollständiger Checkliste" wäre serverseitig nicht durchsetzbar) | ✅ `ChecklistItem`-Instanz-Tabelle im Prisma-Schema; Schema-Kommentar von „fertiges Design" auf „Teil-Design" korrigiert (offene Tabellen benannt) |

### Mittel
| # | Befund | Fix |
|---|---|---|
| M1 | Timer tickte nur bei offenem Modal (Zeitverlust) | ✅ Zeitstempel-basiert (`timerStartedAt` + `timerSeconds()`): läuft bei geschlossenem Detail und über Reloads korrekt weiter |
| M2 | „Heute erfasst" strukturell immer 0 (Demo-Stichtag vs. echtes Buchungsdatum) | ✅ Alle Buchungswege stempeln einheitlich den Demo-Stichtag `HEUTE` |
| M3 | `LaufendeView`/`FilterSidebar` lasen `s.orders` roh (Sichtbarkeits-Leck, widersprüchliche Zähler) | ✅ Beide auf `useVisibleOrders()` (Sidebar zusätzlich ohne laufende Arten — deckungsgleich mit Board) |
| M4 | Mock-Seeds verletzten ua/uv-Regel (FIBU-Aufträge in Unterlagen-Spalten) → Karten konnten unauffindbar werden | ✅ Seeds korrigiert (JA-Aufträge o1/o2 belegen ua/uv; o3/o4 auf bb/av) |
| M5 | Blob-URL-Anhänge: Speicher-Leak + tote Links nach Reload | ✅ Anhänge als data-URLs (überleben Reload, kein Leak), Limit 1,5 MB/Datei mit Hinweis |
| M6 | Server: Cookie ohne `secure`; `COOKIE_SECRET`-Default nicht erzwungen; Sessions ohne TTL; Login-Timing verriet Benutzer-Existenz | ✅ `secure` in Produktion + `maxAge`; Fail-Fast ohne Secret in Produktion; Session-TTL (8 h) mit Sweep; Dummy-Hash-Vergleich gegen Timing |
| M7 | Prisma: `Outbox.payload` als NVARCHAR(1000) (JSON-Bodies zu groß); `TimeEntry` ohne Aufwandsart/`cost_position`; `Anforderung` ohne Nutzer-ID; `User` ohne E-Mail; fehlende FK-Relationen/`Outbox.status`-Index | ✅ `@db.NVarChar(Max)` für Freitexte/Payloads; Felder + Relationen + Index ergänzt |

### Niedrig
Duplicate React-Keys in „Heute erfasst" (jetzt je Mandant aggregiert + sortiert) ✅ ·
toter Rollen-Umschalter-Hinweis in Freigaben (Text korrigiert; `setRole`/`setAdmin` entfernt) ✅ ·
Deaktivierung wirkt jetzt sofort (Abmeldung + `useCurrentUser` prüft `aktiv`) ✅ ·
Planung ohne stillen Rückfall auf fremdes Mitarbeiter-Profil ✅ ·
4xx-Fehlerhandler gibt keine Library-Meldungen mehr durch ✅ ·
Prisma-Skripte ohne installierte Abhängigkeit entfernt ✅

## Ausdrücklich solide (unverändert)
Zentrale Policies werden konsequent genutzt; Notes-Workflow exakt nach Spez.; Immutabilität sauber;
Checklisten-Sperre dreifach durchgesetzt; timezone-sicheres Datums-Handling; Outbox-/Idempotenz-
Modell passt exakt zum verifizierten DATEV-Verhalten; kein Passwort-Hash-Leck (testabgesichert).

## Regel-Präzisierungen aus der Abarbeitung (jetzt in CLAUDE.md)
- Erstplanung und „Umplanen" auf denselben Monat verbrauchen **kein** Kontingent.
- Mitarbeiter-Zurücklegen in den Pool verbraucht das Kontingent (`kontingentVerbrauchen`) —
  Partner/Admin-Zurücklegen setzt es zurück.
- Partner/Admin verschieben direkt (`erzwungen`), zählt wie eine erteilte Freigabe.
- Besonderheiten-Schlüssel ist der **Ordertype** (nicht der Farb-Bucket).

## Stand nach Abarbeitung
Frontend: typecheck/lint sauber, **40 Tests** grün, Build ok. Server: typecheck sauber,
**23 Tests** grün. UI-Nachkontrolle im Browser: fehlerfrei.
