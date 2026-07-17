# Testdrehbuch — Abnahme (Stand 16.07.2026)

> Zum Durcharbeiten mit Screenshots. Jeder Testfall hat **Ziel · Schritte · Erwartetes Ergebnis**
> und eine Spalte **Dein Ergebnis** (OK / nicht OK + Screenshot). Reihenfolge einhalten — die
> Tests bauen teils aufeinander auf.

## Wer testet was?

- **Automatisiert (mache ich):** Zwei Ebenen, die man nicht verwechseln darf:
  - **In der CI (bei jedem Push automatisch):** Typecheck, Lint, die Unit-/Integrationstests
    (Frontend + Server) und der Build. Das läuft bei jeder Änderung durch.
  - **Die Browser-E2E-Suiten** (`tools/e2e/`, Login/Buchen/Checkliste/Zeiterfassungs-Board …)
    starte ich **manuell** — sie brauchen laufende Prozesse + Browser und sind **kein**
    CI-Bestandteil (siehe `tools/e2e/README.md`). Ich führe sie vor größeren Übergaben aus und
    nenne dann Datum/Commit des letzten grünen Laufs. **Das ersetzt aber nicht deinen Blick.**
- **Du testest (die eigentliche Abnahme):** ob es **fachlich richtig aussieht** und sich richtig
  anfühlt — richtige Mandanten, richtige Auftragsarten, sinnvolle Teilaufträge, echte DATEV-Daten.
  Das kann nur jemand beurteilen, der die Kanzlei-Daten kennt. Und die **Echtdaten** kann ich
  technisch gar nicht sehen (kein Netz zu eurem DATEV) — das läuft nur auf deinem Rechner.

**Kurz:** Abschnitte **A–G** kannst du komplett im **Demo-Modus** (`npm run dev`) durchklicken —
schnell, ohne DATEV. Abschnitt **H** braucht den **Server-/Echtdaten-Modus** (`npm run dev:api` +
VPN), das ist der Realdaten-Check.

---

## Vorbereitung

**Für A–G (Demo-Modus, empfohlen zum Durchklicken):**
```
git pull origin claude/magical-gauss-3h604n
npm install
npm run dev
```
Browser: `http://localhost:5173` → unter **„Demo-Schnellanmeldung"** einen Nutzer anklicken.
- **Mitarbeiter-Sicht:** einen Mitarbeiter wählen (sieht nur eigene Aufträge).
- **Partner/Admin-Sicht:** **O. Burchardt** wählen (sieht alles, hat „Verwaltung" + Freigaben).

**Für H (Echtdaten):** siehe `docs/echtdaten-lokal-testen.md` (Server + `npm run dev:api`, VPN aktiv).

---

## A. Anmeldung & Grundgerüst  *(Demo)*

| Nr | Ziel | Schritte | Erwartetes Ergebnis | Dein Ergebnis |
|----|------|----------|---------------------|---------------|
| A1 | Anmeldung Mitarbeiter | Demo-Schnellanmeldung → einen **Mitarbeiter** anklicken | Board erscheint; oben rechts Name + Rolle **„Mitarbeiter"** | |
| A2 | Anmeldung Partner/Admin | Abmelden → **O. Burchardt** anklicken | Rolle **„Partner · Admin"**; in der Leiste zusätzlich **„Verwaltung"** | |
| A3 | Navigationsleiste | Obere Leiste ansehen | Punkte: **Board · Zeiterfassung · Planung · Buchungen · Controlling · Meine Zeiten · Freigaben** (+ Verwaltung nur als Admin) | |
| A4 | Abmelden | Button **„Abmelden"** oben rechts | Zurück zur Anmeldemaske | |

---

## B. Board — nur planbare Aufträge  *(Demo)*

| Nr | Ziel | Schritte | Erwartetes Ergebnis | Dein Ergebnis |
|----|------|----------|---------------------|---------------|
| B1 | Board zeigt nur „planbar" | Als O. Burchardt auf **Board** | Nur planbare Arten: **monatliche FiBu, Jahresabschlüsse, Steuererklärungen, Lohnbuchführung** (u. a.). **Keine** „laufende Steuerberatung / Mehraufwand" und **keine** internen Arten (Urlaub, EDV) | |
| B2 | 10 Status-Spalten | Über das Board scrollen | Kanban mit den Auftragsstatus (Planner-Stil), Karten in Spalten | |
| B3 | Karte kompakt | Eine Karte ansehen | Mandant, Auftragsart (farbig), Auftragsnummer, Planstunden/Frist — **keine** Checkliste/Besonderheiten auf der Karte selbst | |
| B4 | Detail öffnen | Karte anklicken | Detail-Fenster (Modal) öffnet sich mit Status-Leiste, Zeiten, Notes, Checkliste | |

---

## C. Auftragsarten-Farben & Buckets  *(Demo)*

| Nr | Ziel | Schritte | Erwartetes Ergebnis | Dein Ergebnis |
|----|------|----------|---------------------|---------------|
| C1 | Filterleiste ohne Leer-Buckets | Board → linke Filterleiste (Auftragsart) | Nur **planbare** Bucket-Filter, keine leeren/internen | |
| C2 | Farbe je Art | Karten verschiedener Arten vergleichen | Jede Art hat ihre Marken-Farbe (FiBu / JA / Steuer / Lohn unterscheidbar) | |
| C3 | Monatsfilter | Board → Monatsfilter öffnen | Monate **chronologisch** und **nur ab aktuellem Monat vorwärts** (keine alten Monate) | |

---

## D. Teilaufträge — nur der nächste offene  *(Demo)*

| Nr | Ziel | Schritte | Erwartetes Ergebnis | Dein Ergebnis |
|----|------|----------|---------------------|---------------|
| D1 | Chip nur bei echten Teilauftrags-Arten | Karten von **FiBu / Lohn / Mehraufwand / lfd. Beratung** vs. **EÜR / ESt** ansehen | Chip **„Teilauftrag"** nur bei FiBu/Lohn/Mehraufwand/lfd. Beratung. **Nicht** bei EÜR/ESt/JA | |
| D2 | Nur nächster offener | FiBu-Karte mit mehreren Monaten ansehen | Nur **ein** Chip = der **chronologisch nächste noch offene** Teilauftrag (nicht alle, nicht erledigte) | |
| D3 | Detail: alle Teilaufträge | FiBu-Auftrag öffnen | Im Detail die vollständige Teilauftrags-Liste; erledigte abhakbar (`setSuborderDone`) | |

---

## E. Buchungen (Sonstige + Laufende)  *(Demo)*

| Nr | Ziel | Schritte | Erwartetes Ergebnis | Dein Ergebnis |
|----|------|----------|---------------------|---------------|
| E1 | Modul „Buchungen" | Leiste → **Buchungen** | Zwei Abschnitte: **„Laufende Buchungen"** und **„Sonstige Aufträge"** | |
| E2 | Sonstige sind buchbar | In „Sonstige Aufträge" einen Auftrag wählen, Zeit buchen | Zeit lässt sich erfassen (obwohl der Auftrag **nicht** im Board ist) | |
| E3 | Laufende mit Pflicht-Notiz | In „Laufende Buchungen" buchen ohne Notiz | Buchung verlangt **Notiz** (Pflicht) — ohne Notiz nicht buchbar | |
| E4 | Suche | Suchfeld: einmal **Mandantennummer**, einmal **Mandantenname**, einmal **Auftragsnr.** | Liste filtert jeweils korrekt | |

---

## F. Zeiterfassungs-Board (memtime-Stil)  *(Demo)* — Schwerpunkt

| Nr | Ziel | Schritte | Erwartetes Ergebnis | Dein Ergebnis |
|----|------|----------|---------------------|---------------|
| F1 | Board öffnen | Leiste → **Zeiterfassung** | Drei Bereiche: **links Tag**, **Mitte Timeline (07–20 Uhr)**, **rechts Auftrags-Palette** | |
| F2 | Tagesauswahl | Links **Heute / Gestern / Vorgestern** klicken; dann Datumsfeld auf ein anderes Datum | Gewählter Tag wird aktiv markiert; Timeline zeigt den Titel des gewählten Tages | |
| F3 | Palette-Suche | Rechts im Suchfeld eine **Mandantennummer** bzw. einen **Mandantennamen** eingeben | Auftragsliste filtert passend | |
| F4 | Drag & Drop | Einen Auftrag aus der Palette auf eine **Uhrzeit** in der Timeline ziehen | Es erscheint ein **Entwurfs-Block** an dieser Uhrzeit (mit Dauer + Notizfeld) | |
| F5 | Dauer setzen | Im Entwurf **+ / −** klicken (15-Min-Schritte) | Dauer ändert sich in 0,25-h-Schritten; Block wächst/schrumpft | |
| F6 | Buchen | **„Buchen"** klicken | Entwurf verschwindet, **fester Block** erscheint in der Timeline | |
| F7 | Tagessumme | Links auf die Summe schauen | **Tagessumme** und **Balken „von 8 h · %"** sind gestiegen | |
| F8 | Lücken sichtbar | Timeline betrachten | Unbelegte Zeit ist als Lücke sichtbar (memtime-Effekt) | |
| F9 | Tageswechsel | Auf **Gestern** wechseln | Anderer Tag zeigt **eigene** (hier: keine) Buchungen — die von heute sind weg | |
| F10 | Löschen | Auf einem gebuchten (Status „erfasst") Block das **Papierkorb-Symbol** klicken | Block verschwindet, Tagessumme sinkt | |
| F11 | Pflicht-Notiz | Einen **laufenden** Auftrag ziehen, ohne Notiz „Buchen" | Buchung wird **nicht** ausgeführt (Notiz Pflicht) | |

---

## G. Rollen, Freigaben, Checkliste, Umplanung  *(Demo)*

| Nr | Ziel | Schritte | Erwartetes Ergebnis | Dein Ergebnis |
|----|------|----------|---------------------|---------------|
| G1 | Meine Zeiten | Als Mitarbeiter → **Meine Zeiten** | Nur **eigene** Zeiteinträge; „Freigeben" pro Eintrag | |
| G2 | Zeit selbst freigeben | Einen Eintrag **„erfasst"** → **Freigeben** | Status → **„freigegeben"** (keine Partner-Freigabe nötig) | |
| G3 | „Erledigt"-Gate | Board → Auftrag mit offener Pflicht-Checkliste auf **„Erledigt"** ziehen | Wird **abgelehnt**, solange Checkliste nicht vollständig | |
| G4 | Checkliste abhaken | Detail → alle Pflichtpunkte abhaken → auf „Erledigt" | Jetzt erlaubt | |
| G5 | Review-Note (Partner) | Als O. Burchardt in einem Auftrag eine **Review-Note** anlegen | Note-Thread; als Partner: freigeben/zurückgeben/löschen | |
| G6 | Umplanung Freigabe | Als Mitarbeiter einen Auftrag in **anderen Monat** umplanen | Badge **„Freigabe ausstehend"** (außer JA/ESt-Ausnahme 1×/Jahr) | |
| G7 | Partner-Cockpit | Als O. Burchardt → **Freigaben** | Offene Umplanungen + Review-Notes zum Freigeben (Zeiten **nicht** — die brauchen keine Partner-Freigabe) | |

---

## H. Echtdaten (Server-Modus, dein Rechner + VPN)  *(nur du)*

> Voraussetzung: `docs/echtdaten-lokal-testen.md` durchlaufen (Server `npm run dev` + `npm run dev:api`).

| Nr | Ziel | Schritte | Erwartetes Ergebnis | Dein Ergebnis |
|----|------|----------|---------------------|---------------|
| H1 | Echter Login | `http://localhost:5173` → `burchardt` / `demo` | Anmeldung über den **Server** (nicht Demo-Schnellanmeldung) | |
| H2 | Echte Aufträge | Board ansehen | **Echte DATEV-Aufträge** auf dem Board (nur planbare Arten) | |
| H3 | Mandanten-Klarnamen | Karten ansehen | **Klarnamen** der Mandanten (nicht die client-id/GUID) | |
| H4 | Teilaufträge live | FiBu-Auftrag ansehen | Nur der **nächste offene** Teilauftrag als Chip mit Monat | |
| H5 | Plausibilität | Über die Aufträge schauen | Auftragsarten/Fristen/Stunden wirken **fachlich plausibel** (kein „alles gleich benannt") | |
| H6 | Ladezeit | Nach dem Login Board öffnen | Board lädt zügig (Cache greift); Wartetext ehrlich | |

**Notiere bei H alles, was fachlich falsch aussieht** (falscher Mandant, falsche Art, Auftrag der
gar nicht mehr aktiv sein dürfte usw.) — das sind die nächsten Feinschliff-Punkte.

---

## Bekannte offene Punkte (kein Fehler, sondern To-do)

Damit du das beim Testen nicht als Bug meldest — diese Dinge sind **bewusst noch offen**:

1. **Stoppuhr** im Zeiterfassungs-Board ist noch nicht verdrahtet (nur ±-Dauer + Drag&Drop).
2. **Block ziehen/vergrößern** an der Kante geht noch nicht (Dauer über ± ändern).
3. **Uhrzeit eines Blocks** ist reine Anzeige — nach einem Server-Reload stapeln sich Blöcke der
   Reihe nach (DATEV speichert nur Datum + Dauer, keine Startuhrzeit).
4. **Bearbeiter/Partner-Namen** bleiben im Echtdaten-Modus leer, bis die App-Nutzer den echten
   DATEV-Mitarbeiter-IDs zugeordnet sind (als Admin siehst du trotzdem alles).
5. **Alte Jahrgänge** (z. B. EÜR VJ 2025, „Anbauverein Ruhrpott e.V.") stehen ggf. noch im
   Arbeitsvorrat — der Filter dafür ist als nächster Punkt vorgemerkt.

---

## Pentest — brauchen wir das jetzt?

**Kurz: jetzt noch nicht, aber vor dem Echtbetrieb (Go-Live M2) ja.** Begründung:

- **Was schon läuft:** Ich habe einen automatisierten **Security-Review** (`/security-review`)
  gefahren und serverseitige Härtungen umgesetzt: Rollen-/Workflow-Gating **serverseitig**
  erzwungen (nicht nur in der Oberfläche), Login-Fehlversuchs-Sperre (5 → 15 Min.), Eingabegrenzen
  (u. a. max. 12 h/Tag), Produktions-Fail-Fast (kein Demo-Login in Produktion), Idempotenz gegen
  Doppelbuchung, TLS-Insecure nur im Dev.
- **Warum ein echter Pentest trotzdem sinnvoll ist — aber später:** Die App verarbeitet
  **Mandantendaten** und hält **DATEV-Zugangsdaten**. Ein externer Pentest lohnt sich, sobald das
  **echte Backend produktiv** steht (MS-SQL-Modus, echter Login, DATEV-Rückschreibung, E-Mail-Job)
  — dann testet man das laufende System, nicht die Baustelle. Ein Pentest auf dem jetzigen
  Dev-Stand würde v. a. Dinge finden, die für Produktion ohnehin umgestellt werden.
- **Empfehlung:** In dieser Phase reicht (a) der laufende automatisierte Security-Review bei jeder
  größeren Änderung und (b) das gemeinsame Durchgehen der Rollen-Regeln (Abschnitt G). **Vor
  Go-Live** dann ein **beauftragter externer Pentest** des Produktionssystems — das ist auch der
  Zeitpunkt, an dem so etwas gegenüber Mandanten/Berufsrecht sauber dokumentierbar ist.

Wenn du magst, kann ich einen **Pentest-Vorbereitungs-Steckbrief** anlegen (Umfang, was zu testen
ist, welche Zugänge ein Prüfer braucht) — dann liegt das fertig, wenn es so weit ist.
