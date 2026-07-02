# M1-Abnahme — Checkliste zum Durchklicken

> Zweck: M1 (klickbarer Prototyp mit Mock-Daten) **strukturiert prüfen und formal abnehmen**.
> Hake ab, was passt; notiere Auffälligkeiten. Was offen ist, fixe ich; danach gilt M1 als
> abgenommen und wir gehen in M2 (Backend/DATEV).
>
> **Vorbereitung:** App lokal starten (`npm run dev`), Branch `claude/magical-gauss-3h604n`.
> Beim ersten Start einmal **hart neu laden** (Stand-Version aktualisiert). Du landest auf dem
> **Login** — dort einen Demo-Nutzer wählen.
>
> Selbst-Audit (27.06.2026): alle Module beide Rollen ohne Konsolenfehler; Kernflüsse (Status,
> Zeit, Note, Checkliste, Besonderheiten, Schnellbuchung, laufende Buchung) fehlerfrei;
> `typecheck`/`lint`/`test` (32) /`build` grün.

## Demo-Anmeldungen
| Nutzer | Rolle | Sieht |
|---|---|---|
| **S. Wolf** | Mitarbeiter | nur eigene zugewiesene Aufträge |
| **M. Klein / T. Berg** | Mitarbeiter | nur eigene |
| **A. Peters** | Partner (ohne Admin) | nur **seine** Mandate (3 Aufträge, T. Berg) — keine Verwaltung |
| **O. Burchardt** | Partner + **Admin** | alles + Modul „Verwaltung" |

> Hinweis: Login/Sichtbarkeit sind eine **Vorschau**, noch nicht verbindlich (echte Sicherheit = M2).

---

## 1. Login & Rollen
- [ ] Ohne Anmeldung erscheint nur der Login; nach Wahl eines Nutzers öffnet sich die App.
- [ ] Oben rechts steht der angemeldete Nutzer + Rolle; „Abmelden" führt zurück zum Login.
- [ ] Als **S. Wolf** sind weniger Aufträge sichtbar als als **O. Burchardt**.
- [ ] „Verwaltung" ist nur bei **O. Burchardt** (Admin) in der Navigation.
- [ ] Als **A. Peters** (Partner ohne Admin): nur seine 3 Mandate sichtbar, **keine** Verwaltung.
- [ ] Nach einem **Reload** bleiben Rolle/Admin-Rechte erhalten (Partner kann weiter freigeben).

## 2. Board (Auftragsabwicklung)
- [ ] 10 Status-Spalten; Karten tragen Auftragsart-Badge, Mandant, Monat, Soll/Ist-Chips.
- [ ] Spalten „Unterlagen anfordern/vollständig" zeigen den Hinweis „nur JA".
- [ ] Karte per **Drag & Drop** in eine andere Spalte ziehen → Status wechselt.
- [ ] Eine Karte mit unvollständiger Checkliste auf „Erledigt" ziehen → öffnet die Karte statt zu erledigen.
- [ ] Linke Filter (Mitarbeiter/Monat/VJ/Auftragsart/Schnellfilter) wirken auf das Board.
- [ ] KPI-Kopf zeigt zugeteilt / in Bearbeitung / Zeiten offen / Review Notes.
- [ ] Rechte Spalte: „Heute erfasst", „Offene Zeiten", „Review Notes".
- [ ] Suche oben findet Mandant/Auftrags-Nr.

## 3. Auftrags-Detail (Karte öffnen)
- [ ] Kopf mit Mandant, Auftragsart, Status, Meta (Auftrags-/Mandanten-Nr., VJ, Monat, Partner, Bearbeiter).
- [ ] Status-Leiste ändert den Status; „Erledigt" gesperrt bei offener Checkliste (mit Hinweistext).
- [ ] Stunden-Balken (erfasst/Soll/Rest) stimmt.
- [ ] **Zeit erfassen**: Timer (Start/Reset/Übertragen) **und** manuell (Stunden + optional Notiz).
- [ ] **Timer läuft weiter**, auch wenn das Detail geschlossen wird; Start eines Timers auf einer
      anderen Karte **pausiert** den ersten (nur ein Timer gleichzeitig).
- [ ] Erfasste Zeiten erscheinen in der Liste mit Status „Erfasst"; **Freigeben** schaltet auf „Freigegeben".
- [ ] Ein erfasster (noch nicht freigegebener) Eintrag lässt sich über das **Papierkorb-Symbol löschen**.
- [ ] Als **Partner/Admin**: der **Bearbeiter** ist im Meta-Bereich per Auswahlfeld **zuweisbar**.
- [ ] **Checkliste** (Button im Kopf): Punkte abhaken/hinzufügen/entfernen.
- [ ] **Besonderheiten** (nur bei passender Auftragsart): Eintrag anlegen/bearbeiten.
- [ ] **Laufende Zeit buchen** (Schnellbuchung): bucht auf den passenden laufenden Auftrag.
- [ ] **Teilaufträge** (FiBu/Lohn): Monatsraster, Klick schaltet „erledigt".
- [ ] **Review Notes / Fragen**: anlegen, kommentieren, Status; Datei anhängen.

## 4. Umplanung (Regel JA/ESt)
- [ ] Als **S. Wolf** eine **JA- oder ESt-Karte** öffnen → bei „Umplanung" erscheint **„Umplanen"** (grün)
      mit Hinweis „1× pro Jahr ohne Freigabe".
- [ ] Nach einmaligem Umplanen erscheint beim nächsten Mal **„Freigabe anfordern"** (Partner nötig).
- [ ] Bei einer **anderen** Auftragsart (z. B. FiBu) ist Umplanung immer „Freigabe anfordern".
- [ ] In der **Planung** einen bereits geplanten Auftrag in einen anderen Monat ziehen → bei
      aufgebrauchtem Kontingent erscheint der Badge „→ Zielmonat" (Freigabe ausstehend).

## 5. Auftrags-Anforderung
- [ ] Im Board-Kopf **„Auftrag anfordern"** → Formular ausfüllen → „Anforderung senden".
- [ ] Die neue Anforderung erscheint unten unter „Meine Anforderungen" mit Status „Angefordert".
- [ ] Als **O. Burchardt** in **Verwaltung** → „Auftrags-Anforderungen": „als angelegt melden" / „ablehnen (Grund)".
- [ ] Nach „als angelegt melden" zeigt die Anforderung beim Mitarbeiter den Status „Angelegt".

## 6. Planung
- [ ] Pool „Noch nicht geplante Aufträge" oben; Kalender mit Monatskapazität unten.
- [ ] Auftrag aus dem Pool in einen Monat ziehen → Kapazitätsbalken/Stunden aktualisieren sich.
- [ ] Teilzeit: bei einem Teilzeit-Mitarbeiter ist die Monatskapazität niedriger.
- [ ] Als Mitarbeiter ist der Mitarbeiter-Wähler gesperrt (nur eigene Planung); als Admin frei wählbar.

## 7. Meine Zeiten
- [ ] Persönliche Zeitübersicht (offen / freigegeben / ohne Zeit); eigene Zeiten selbst freigeben/zurückziehen.
- [ ] Bei mehreren offenen Zeiten erscheint **„Alle n freigeben"** (Sammel-Freigabe).

## 8. Freigaben (Partner)
- [ ] Als **O. Burchardt**: offene Umplanungen freigeben/ablehnen; Review-Notes freigeben/zurück.
- [ ] Nach einer **Ablehnung** sieht der Mitarbeiter am Auftrag den Hinweis
      „Anfrage → Monat vom Partner abgelehnt" (mit „Verstanden" wegklickbar).
- [ ] (Hinweis: Zeiten brauchen **keine** Partner-Freigabe — das ist gewollt.)

## 9. Controlling
- [ ] Drei Kacheln (Überfällig / Planwert überschritten / Nicht abgerechnet) mit passenden Listen.
- [ ] Stichtag 20.3.2025 wird genannt.

## 10. Laufende Buchungen
- [ ] Beratung/Mehraufwand mit **Pflicht-Notiz**; bei Mehraufwand zusätzlich **Aufwandsart** wählbar.

## 11. Verwaltung (nur Admin)
- [ ] Nutzerliste mit Rolle/Rechten/DATEV-ID/Tagessoll/Tage-pro-Woche; anlegen/bearbeiten/deaktivieren.
- [ ] **Checklisten verwalten** (je Auftragsart bearbeiten/zurücksetzen) und **Aus Excel/CSV importieren**.
- [ ] **Auftrags-Anforderungen**-Inbox (siehe Punkt 5).

## 12. Allgemein / Optik
- [ ] Marken-Look (Farben/Typografie) konsistent; keine Emojis; nichts „springt".
- [ ] Reload verliert keinen Stand (lokale Speicherung).

---

## Bekannte, bewusste Grenzen in M1 (kein Mangel — kommt in M2)
- **Login/Sichtbarkeit nicht verbindlich** (echte Server-Autorisierung = M2).
- **Keine DATEV-Verbindung** (Daten aus Mock); Rückschreiben/Sync = M2.
- **E-Mail-Reminder**, **Datei-Anhänge dauerhaft speichern**, **Auftragsart-Konfig in DB**,
  **Feiertage/Urlaub in der Kapazität**: M2.
- **Logo-Asset** noch Platzhalter.

## Abnahme
- [ ] **M1 abgenommen** — offene Punkte oben notiert und an Claude übergeben.
- Datum / Name: ____________________
