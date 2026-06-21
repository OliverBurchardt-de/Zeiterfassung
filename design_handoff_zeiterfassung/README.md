# Handoff: Zeiterfassung & Auftragsabwicklung (Burchardt & Kollegen)

## Overview
Interne Web-App für die Steuerkanzlei **Burchardt & Kollegen**, in der Mitarbeiter an einer
Stelle drei Dinge erledigen:

1. **Auftragsplanung** — alle Aufträge sehen, filtern (Zuständigkeit, geplanter Monat,
   Auftragsart) und so den persönlichen **Arbeitsvorrat** bilden.
2. **Auftragsabwicklung** über ein **Kanban-Board** (Planner-Stil): Aufträge wandern durch
   10 Status-Buckets.
3. **Zeiterfassung** direkt am Auftrag (Live-Timer oder manuell), inkl. Freigabe-Workflow.

Aufträge stammen aus **DATEV EO** (Eigenorganisation) und werden per API eingelesen.
Review-Anmerkungen und Freigaben laufen zwischen **Mitarbeiter** und
**mandatsverantwortlichem Partner**.

Dieses Paket dokumentiert die **High-Fidelity-Prototypen** so, dass ein Entwickler die App
ohne Kenntnis dieser Konversation umsetzen kann.

---

## About the Design Files
Die HTML-Dateien in diesem Bundle sind **Design-Referenzen** — interaktive Prototypen, die
Aussehen und Verhalten zeigen. Sie sind **kein** produktiv zu übernehmender Code.

Aufgabe: Diese Designs in der **Zielumgebung neu aufbauen**. Das Ziel-Repo
(`github.com/OliverBurchardt-de/Zeiterfassung`) ist aktuell **leer** — es gibt also noch
kein Framework. Empfehlung: ein modernes Web-Stack, das gut zu DATEV-/Microsoft-Umgebungen
passt, z. B. **React + TypeScript** (Vite oder Next.js), State via React Query (Server-State)
+ Zustand/Context (UI-State), Drag & Drop via `@dnd-kit`. Wählen Sie final, was zum Team passt.
Die Prototypen-Logik (in `*.dc.html`) ist ein hauseigenes Format und dient nur als
Verhaltens-Referenz, nicht als Vorlage zum Kopieren.

> **Backend ist nicht Teil dieses Designs.** Felder, Status und Workflows hier definieren die
> Anforderungen an die DATEV-EO-Anbindung und die eigene Persistenz (Zeiten, Notes, Status,
> Umplanungs-Freigaben). Backend/API-Design ist separat zu spezifizieren.

---

## Fidelity
**High-fidelity (hifi).** `Zeiterfassung Prototyp.dc.html` verwendet finale Marken-Farben,
Typografie, Abstände und Interaktionen aus dem Burchardt-&-Kollegen-Design-System. Pixelnah
nachbauen, dabei die Komponenten-Bibliothek des Zielprojekts nutzen.

`Zeiterfassung Wireframes.dc.html` ist ein **Lo-fi-Wireframe** (Skizzen-Look) und zeigt
zusätzlich **zwei alternative Board-Layouts** (klassisches Board / Phasen-Swimlanes) — nur als
Ideen-Referenz. Verbindlich ist das Hi-fi-Dashboard-Layout (Variante B).

---

## Domänenmodell

### Auftrag (Order) — Quelle: DATEV EO
| Feld | Typ | Quelle / Hinweis |
|---|---|---|
| `id` | string | EO |
| `mandant` | string | Mandantenname |
| `mandantNr` | string | z. B. `D10217` |
| `auftragsNr` | string | z. B. `A-2025-1119` |
| `art` (Auftragsart) | string | z. B. „Jahresabschluss 2024", „Umsatzsteuer-Voranmeldung", „Lohnbuchhaltung", „Einkommensteuer", „Finanzbuchhaltung" |
| `fristStart`, `fristEnde` | date | In EO gepflegt. **Der „geplante Monat" wird daraus abgeleitet** (i. d. R. aus dem Enddatum). |
| `monat` | abgeleitet | Anzeige z. B. „Mär 2025" |
| `soll` (Soll-Stunden) | number | Planwert |
| `seiten` (Ist-Seiten) | number | EO-Istwert |
| `kosten` (Ist-Kosten) | string/number | EO-Istwert, € |
| `status` | enum | siehe Status-Buckets |
| `bearbeiter` | string/ref | zugeordneter Mitarbeiter |
| `partner` (verantw.) | string/ref | mandatsverantwortlicher Partner |
| `checklist` | Item[] | Unterlagen-Checkliste (s. u.) |
| `notes` | Note[] | Review Notes / Fragen (s. u.) |
| `times` | TimeEntry[] | erfasste Zeiten (s. u.) |
| `umplanung` | bool/Objekt | offene Umplanungs-Freigabe |

### Status-Buckets (Kanban-Spalten, in dieser Reihenfolge)
| id | Label | Akzentfarbe | Nur best. Arten? |
|---|---|---|---|
| `av` | Arbeitsvorrat | `#6E6E6E` | nein (alle noch nicht begonnenen) |
| `ua` | Unterlagen anfordern | `#E94E1B` | **ja** (per Auftragsart) |
| `uv` | Unterlagen vollständig | `#0080C9` | **ja** (per Auftragsart) |
| `bb` | Bearbeitung begonnen | `#0080C9` | nein |
| `rf` | Reviewfähig | `#F7B234` | nein |
| `rn` | Review Notes | `#E94E1B` | nein |
| `fg` | Freigegeben | `#3A5791` | nein |
| `am` | An Mandant übermittelt | `#3A5791` | nein |
| `fa` | Beim FA eingereicht | `#3A5791` | nein |
| `er` | Erledigt | `#2E7D5B` | nein |

> Die Spalten `ua`/`uv` erscheinen nur für Auftragsarten, die einen Unterlagen-Prozess haben
> (Definition über die Auftragsart, im Prototyp markiert mit „nur best. Auftragsarten").

Status wechselt auf **zwei** Wegen: per **Drag & Drop** zwischen den Spalten **und** über die
Status-Leiste im Karten-Detail.

### Rollen
- **Mitarbeiter** (Sachbearbeiter, z. B. „S. Wolf", Initialen SW) — Standard-Sicht.
- **Partner** (mandatsverantwortlich, z. B. „O. Burchardt", OB).
Im Prototyp gibt es oben rechts einen Rollen-Umschalter (nur zu Demozwecken; in Produktion
über die Anmeldung/Berechtigung).

### Review Notes / Fragen (Note) — Thread-Modell
```
Note {
  id, text, author,
  kind:  'frage' | 'review',     // 'frage' = Frage/Hinweis (nur Mitarbeiter anlegen)
                                  // 'review' = Review Note  (nur Partner anlegen)
  noteState: 'offen' | 'erledigt' | 'freigegeben',
  comments: Comment[]            // Comment { id, text, author, role:'mitarbeiter'|'partner' }
}
```
**Regeln:**
- **Anlegen:** beide Rollen. Der **Typ richtet sich nach der Rolle** — Mitarbeiter erzeugen
  `frage`, Partner erzeugen `review`. In der Erfassungsmaske ist der jeweils andere Typ
  sichtbar **gesperrt** dargestellt.
- **Bearbeiten** (Text editieren) und **Kommentieren:** beide Rollen.
- **Als erledigt melden** (`offen → erledigt`, Rückmeldung an Partner): **Mitarbeiter**.
- **Finales Freigeben** (`→ freigegeben`, Note wird gesperrt) und **Löschen:** **nur Partner**.
- Partner-Zusatzaktionen: „Zurück an Mitarbeiter" (`erledigt → offen`), „Wieder öffnen"
  (`freigegeben → offen`).
- **Offen-Zähler** einer Karte = Notes mit `noteState !== 'freigegeben'`. Treibt das
  „Review-Note(s)"-Badge auf der Board-Karte und die Seitenliste „Review Notes".

`noteState`-Badges:
| state | Label | Farbe / Soft-BG |
|---|---|---|
| `offen` | „Offen" | `#B5791A` / `#FDEFD2` |
| `erledigt` | „Erledigt – wartet auf Freigabe" | `#0080C9` / `#DCEFF9` |
| `freigegeben` | „Freigegeben" | `#2E7D5B` / `#DCEDE4` |

`kind`-Badges:
| kind | Label | Farbe / Soft-BG |
|---|---|---|
| `frage` | „Frage / Hinweis" | `#0080C9` / `#DCEFF9` |
| `review` | „Review Note" | `#3A5791` / `#E1E6F0` |

### Unterlagen-Checkliste (ChecklistItem)
`{ id, label, done }` — pro Auftrag. **Voll editierbar:** abhaken (Toggle), löschen,
hinzufügen (Eingabefeld + Enter/„Hinzufügen"). Default-Items für Jahresabschluss/`ua`/`uv`:
„Summen- & Saldenliste", „Kontonachweise", „Inventar / Bestände", „Anlagenverzeichnis".

### Zeiterfassung (TimeEntry)
`{ id, datum, dauer, freigegeben: bool }`. Erfassung am Auftrag **per Live-Timer** (Start /
Pause / Reset) **oder manuell**. „In Karte übertragen" schreibt die laufende Dauer als Eintrag,
der zunächst **„nicht freigegeben"** ist (Freigabe durch Partner). 
**E-Mail-Reminder (Backend-Job):** Aufträge **ohne erfasste Zeit** oder mit **nicht
freigegebenen Zeiten** werden in festen Intervallen per E-Mail an den Bearbeiter gemeldet.

### Umplanung
Auftrag in anderen Monat verschieben → erzeugt eine **Freigabe-Anfrage an den
mandatsverantwortlichen Partner**. Bis zur Freigabe trägt die Karte das Badge
**„Freigabe ausstehend"** (`#7a5400` auf `#FDEFD2`).

---

## Screens / Views

### 1) Top-Bar (sticky, global)
- Höhe ~ 54 px, weiß `rgba(255,255,255,0.97)` + `backdrop-filter: blur(8px)`,
  Unterkante `1px solid #E5E7EC`. Padding `12px 28px`.
- **Logo** links (`assets/logo.jpg`, Höhe 30 px), danach vertikaler Trenner `1px #E5E7EC`.
- **Modul-Nav** (Pills): „Board" (aktiv), „Meine Zeiten", „Freigaben".
  Aktiv: BG `#F2F4F8`, Text `#3A5791`, 600. Inaktiv: Text `#333`, 500. Padding `7px 14px`,
  radius `999px`. (Nur „Board" ist im Prototyp umgesetzt.)
- Rechts: **Suchfeld** (Pill, BG `#F2F4F8`, Border `#E5E7EC`, Lupe-Icon), **Rollen-Umschalter**
  (segmented Pill), **User-Chip** (Avatar-Kreis 34 px `#3A5791`, Initialen Petrona 600 14px;
  Name 14px/600, Rolle 12px `#6E6E6E`).

### 2) Seitenkopf + KPIs
- Eyebrow „AUFTRAGSABWICKLUNG" (12px, 600, `letter-spacing:.18em`, uppercase, `#0080C9`).
- H1 „Auftrags-Board" (Petrona 600, 34px, `#333`).
- **KPI-Karten** (4×), je weiß, Border `#E5E7EC`, radius 14px, `box-shadow:0 1px 2px rgba(20,28,48,.06)`,
  Padding `12px 18px`, min-width 128px. Große Zahl Petrona 600 30px in Akzentfarbe, Label 13px `#6E6E6E`:
  „15 zugeteilt" (`#333`), „3 in Bearbeitung" (`#0080C9`), „2 Zeiten offen" (`#E94E1B`),
  „1 Review Notes" (`#F7B234`).

### 3) Hauptlayout — 3 Spalten (verbindlich, Variante B)
`display:grid; grid-template-columns:236px minmax(0,1fr) 312px; gap:20px;
padding:6px 28px 48px; max-width:1640px; margin:0 auto; align-items:start`.

**3a) Linke Filter-Leiste** (sticky `top:84px`, weiße Karte, radius 14px, Padding 18px)
- H4 „Arbeitsvorrat" (Petrona 600, 18px).
- **Mitarbeiter-Liste** (Avatar-Kreis 24px + Name + Anzahl rechts). Aktiv: BG `#EAF4FB`,
  Text `#0080C9`, 600, Avatar `#0080C9`; inaktiv Avatar `#B7BCC6`. Einträge: S. Wolf, M. Klein,
  T. Berg, „Mein Team".
- **Geplanter Monat** — Select-Pill (Border `#E5E7EC`, radius 8px), z. B. „März 2025".
- **Auftragsart** — Checkbox-Liste (Box 18px, radius 5px; an = `#0080C9`-Fill mit ✓,
  aus = Border `#D4D9E2`): Jahresabschluss, Umsatzsteuer, Lohn, Einkommensteuer.
- **Schnellfilter** — „Nur offene Zeiten", „Freigabe ausstehend".
- Sektions-Label: 12px, 600, `.04em`, uppercase, `#6E6E6E`.

**3b) Board (Mitte)** — `min-width:0`, darin `display:flex; gap:14px; overflow-x:auto`.
- **Spalte:** `width:248px`, BG `#F2F4F8`, Border `#E5E7EC`, radius 14px. Oben 4px-Akzentbalken
  in Spaltenfarbe. Kopf: Status-Punkt (9px) + Label (Petrona 600 15px) + Count-Pill
  (12px/600, Farbe = Spaltenfarbe, BG = Soft-Variante). Optionaler Hinweis „nur best.
  Auftragsarten" (dashed).
- **Auftrags-Karte:** weiß, Border `#E5E7EC`, **`border-left:3px solid <Spaltenfarbe>`**,
  radius 10px, `box-shadow:0 1px 2px rgba(20,28,48,.06)`, Padding `11px 12px`, `cursor:pointer`.
  Hover: `box-shadow:0 4px 14px rgba(20,28,48,.10); transform:translateY(-1px)`.
  Inhalt: Mandant (Petrona 600 15.5px) + Art-Kürzel-Badge (10.5px/700, weiß auf Art-Farbe);
  Auftragsart (13px `#6E6E6E`); Chips (11.5px `#3A5791` auf `#F2F4F8`, radius 6px):
  „Soll N h", Monat, „N S.", Kosten. Zustands-Zeilen:
  - Timer läuft: Punkt `#E94E1B` (blinkt) + „mm:ss h läuft" (`#E94E1B`, 600).
  - Zeit offen: Punkt `#B7BCC6` + „… · nicht freigegeben" (`#6E6E6E`).
  - „Freigabe ausstehend" (Badge `#7a5400` auf `#FDEFD2`).
  - „N Review-Note(s)" (Badge weiß auf `#E94E1B`).
- **Art-Kürzel & Farben:** JA=`#0080C9`, USt=`#3A5791`, LOHN=`#E94E1B`, ESt=`#7a5400`,
  FIBU=`#2E7D5B`.

**3c) Rechte Spalte** (sticky `top:84px`, 3 weiße Karten):
- **„Heute erfasst":** große Ist-Zahl (Petrona 600 36px, `#0080C9`) „/ 8,0 h Soll",
  Fortschrittsbalken (Höhe 10px, BG `#F2F4F8`, Fill `#0080C9`, ≥100 % `#2E7D5B`),
  „noch X h bis zum Tagessoll", darunter Liste Mandant→Stunden.
- **„Offene Zeiten":** roter Punkt + Liste (Mandant/Art/Status in `#E94E1B`), Fußnote
  „Wird in festen Intervallen per E-Mail an den Bearbeiter gemeldet."
- **„Review Notes":** gelber Punkt + Liste klickbarer Einträge (Mandant/Art/„N offen").

### 4) Karten-Detail (Modal/Overlay)
Overlay: `position:fixed; inset:0; background:rgba(28,38,64,.42); backdrop-filter:blur(2px)`,
oben ausgerichtet, scrollbar. Karte: **940 px** breit, weiß, radius 18px,
`box-shadow:0 24px 60px rgba(20,28,48,.28)`. Schließen per ✕ oder Klick auf Backdrop.

Aufbau (von oben):
1. **Kopf:** Mandant (Petrona 600 28px) + Art-Kürzel-Badge + **Status-Pill** (Punkt + Label,
   Farbe/Soft = Statusfarbe). Darunter Auftragsart (16px `#6E6E6E`). **Meta-Leiste** (Label
   11.5px `#9aa0ab`, Wert 14px/600): Auftrags-Nr., Mandanten-Nr., Geplanter Monat,
   Verantw. Partner, Bearbeiter.
2. **„Status ändern":** BG `#F2F4F8`; alle 10 Status als Pills; aktiver Pill in Statusfarbe
   (weiß, 600), übrige weiß/`#E5E7EC`/`#6E6E6E`. Klick = Statuswechsel (wirkt sofort aufs Board).
3. **„Stunden"-Leiste:** Fortschrittsbalken Ist/Soll, rechts „X,X h erfasst / N h Soll · noch Y".
4. **2-Spalten-Grid (`1fr 1fr`):**
   - **Links „Plandaten für den Monat":** Geplanter Zeitraum (zwei Datums-Felder aus EO, →),
     abgeleiteter Monat; Soll-Stunden; Ist-Seiten; Ist-Kosten; **Umplanung**: „Monat wählen"
     + **„Freigabe anfordern"** (amber Pill) + Hinweistext.
   - **Rechts „Zeit erfassen":** Timer-Box (BG `#F2F4F8`, radius 14px): Zeit (Petrona 600 46px,
     tabular-nums), **Start/Pause** (Start `#0080C9`, Pause `#E94E1B`) + **Reset** (weiß),
     **„X,XX h in Karte übertragen"** (amber). Darunter **„Erfasste Zeiten"** (Datum/Dauer/Badge
     freigegeben=`#2E7D5B`, nicht freigegeben=`#7a5400`/`#FDEFD2`) und **„Unterlagen-Checkliste"**
     (editierbar: Toggle-Box, Löschen-Icon je Zeile, Eingabe + „Hinzufügen").
5. **Review Notes (volle Breite, oberhalb Trenner):** Überschrift „Review Notes" + Zähler
   „N offen · M freigegeben". Pro Note eine Karte (BG offen `#FFFCF4` / gesperrt `#F8F9FB`,
   Border `#EBD9A8`/`#E5E7EC`, radius 12px): Status-Punkt, **editierbarer Text** (Textarea;
   `readonly`, wenn `freigegeben`), **kind-Badge**, **state-Badge**, Löschen-Icon (**nur Partner**),
   „von <Autor>". Darunter **Kommentar-Thread** (linker Border `2px #EBE4D2`; je Kommentar
   Autor-Zeile in Rollenfarbe Partner `#3A5791` / Mitarbeiter `#0080C9`, dann Text). Dann
   **Kommentar-Eingabe** + Aktions-Buttons (rollen-/zustandsabhängig, s. „Review Notes"-Regeln).
   Unten **Erfassungsmaske**: „Typ:"-Anzeige (zwei Pills, der rollenfremde gesperrt) +
   Eingabe (Placeholder rollenabhängig) + „Anlegen" (`#3A5791`) + Hinweistext.

---

## Interactions & Behavior
- **Karte öffnen:** Klick auf Board-Karte oder Eintrag in „Review Notes"-Liste → Detail-Modal.
- **Statuswechsel:** Drag & Drop zwischen Spalten **oder** Status-Pill im Detail. Beide
  mutieren denselben `order.status`; Board und Badges aktualisieren sofort.
- **Timer:** `setInterval` 1 s, läuft nur bei „running". Start/Pause toggelt, Reset = 0,
  „übertragen" stoppt und erzeugt TimeEntry (nicht freigegeben).
- **Notes:** anlegen (Enter oder Button), inline editieren (Textarea-`onChange`), kommentieren,
  Zustände nach Rollen-Matrix; gesperrt (readonly), sobald `freigegeben`.
- **Checkliste:** Toggle / Löschen / Hinzufügen (Enter oder Button).
- **Rollen-Umschalter:** ändert verfügbare Aktionen + Erfassungs-Typ (Demo-Schalter).
- **Hover:** Karten heben sich (Shadow + −1px Y); Buttons dunkeln ~6 % (amber → `#E5A11C`,
  deep-blue → `#314a7c`).
- **Animation:** dezent, `ease-out`, 160–300 ms; blinkender Punkt für laufenden Timer
  (`@keyframes bk-pulse`, 1.1 s).

## State Management
Pro geöffnetem Auftrag (`openCard`): `orders[]` als Single Source of Truth; alle Mutationen
(Status, Notes, Kommentare, Checkliste, Zeiten) immutabel auf das jeweilige Order-Objekt.
Weitere UI-States: `role`, `employee` (Filter), `timerRunning`/`timerSec`, Entwürfe
(`noteDraft`, `checklistDraft`, `commentDrafts` je Note-id). In Produktion: Server-State (Orders,
Times, Notes) über die API/DATEV-EO laden und persistieren; UI-State lokal.

## Design Tokens (Burchardt & Kollegen)
**Farben** — Anthrazit `#333333` (Text, kein reines Schwarz), Text-Sekundär `#6E6E6E`,
Hellgrau-Text `#9aa0ab`; Blau `#0080C9`, Saphirblau (deep) `#3A5791`, Signalgelb `#F7B234`
(+ hover `#E5A11C`), Blutorange `#E94E1B`; Erfolg/Grün `#2E7D5B` (Erweiterung, nur „Erledigt"/
freigegeben); Flächen: Paper `#FAFAF8`, Cloud `#F2F4F8`, Hairline `#E5E7EC`, Box `#D4D9E2`.
**Soft-Tints:** Blau `#DCEFF9`, Deep `#E1E6F0`, Amber `#FDEFD2`, Orange `#FBE4DB`, Grün `#DCEDE4`.
**Typografie:** Display/Headlines/Zahlen **Petrona** (serif, 500–600); Body **Aleo** (sans).
Skala: Display 64 / H1 44 (Hero 34 hier) / H2 32 / H3 24 / H4 20 / Lead 20 / Body 17 / Small 14 /
Caption 12. Eyebrow: 12px, `letter-spacing:.18em`, uppercase, `#0080C9`.
**Radius:** sm 4 / md 8 / lg 14 / xl 22 / pill 999. **Spacing (8pt):** 4/8/12/16/24/32/48/64/96.
**Shadows:** `0 1px 2px rgba(20,28,48,.06)` / `0 4px 14px rgba(20,28,48,.08)` /
`0 12px 32px rgba(20,28,48,.12)`. **Buttons:** CTA = Pill, amber, Text `#333`; sekundär = deep-blue.
**Keine Emojis.** Icons im Prototyp: Lucide-Stil (Strich 2px) bzw. die hauseigenen
Service-SVGs der Kanzlei.

## Assets
- `assets/logo.jpg` — Wortmarke „Burchardt **&** Kollegen" (goldenes &). Im Ziel-Repo durch das
  offizielle Logo-Asset ersetzen; idealerweise SVG/transparentes PNG.
- `fonts/Petrona_wght_.ttf`, `fonts/Petrona-Italic_wght_.ttf` — variable Petrona (Display).
  **Aleo** (Body) via Google Fonts. Beide sind die offiziellen Markenschriften.
- Icons: aktuell Inline-SVG (Lucide-ähnlich). Im Ziel-Projekt eine Icon-Lib (z. B. Lucide React)
  verwenden; die kanzleieigenen Service-SVGs liegen im Design-System.

## Files
- `Zeiterfassung Prototyp.dc.html` — **Hi-fi-Prototyp** (verbindlich). Dashboard, Board,
  Karten-Detail mit Timer, Status, Checkliste, rollenbasierten Review Notes.
- `Zeiterfassung Wireframes.dc.html` — Lo-fi-Wireframe mit den 3 Board-Layout-Varianten
  (nur Referenz; verbindlich ist Variante B = Dashboard).
- `Zeiterfassung Prototyp (standalone).html` — falls beigelegt: in sich geschlossene,
  im Browser direkt öffenbare Fassung des Hi-fi-Prototyps zum Ansehen.

> Die `.dc.html`-Dateien sind im hauseigenen Prototyp-Format und benötigen die Laufzeit der
> Design-Umgebung zum Rendern. Für eine schnelle Voransicht die Standalone-Datei nutzen.

### Zusätzlich im Paket (für die Umsetzung)
- `CLAUDE.md` — Projektkontext + Stack-Empfehlung + Konventionen für Claude Code. Diese Datei
  ins Repo-Root legen, damit Claude Code sie in jeder Session liest.
- `design-tokens.css` — fertige CSS-Variablen (Marken-Farben, Status-/Typ-Farben, Typo, Radius,
  Spacing, Shadows). Direkt importierbar.
- `design-tokens.ts` — dieselben Tokens als TypeScript inkl. `STATUS`, `NOTE_KIND`, `NOTE_STATE`
  und einer fertigen `notePolicy` (Rollen-Regeln für Review Notes).
- `screenshots/` — Referenzaufnahmen:
  - `board.png` — Dashboard / Board (Mitarbeiter)
  - `detail-top.png` — Karten-Detail Kopf, Status-Leiste, Stunden, Plandaten, Timer
  - `notes-mitarbeiter.png` — Review-Notes-Bereich, Mitarbeiter-Sicht (Als erledigt melden)
  - `notes-partner.png` — Review-Notes-Bereich, Partner-Sicht (Freigeben / Löschen / Zurück)

### Empfohlene Repo-Struktur (Vorschlag)
```
/                      ← App-Code (React + TS, Vite)
  CLAUDE.md            ← aus diesem Paket
  /src
    /styles/tokens.css ← design-tokens.css
    /lib/tokens.ts     ← design-tokens.ts
    /features/board    ← Board, Spalten, Karten, Drag & Drop
    /features/order    ← Karten-Detail, Status, Plandaten, Umplanung
    /features/time     ← Timer + manuelle Erfassung + Freigabe
    /features/notes    ← Review-Notes-Thread + Rollen-Policy
  /design              ← dieses Handoff-Paket (README, Prototyp, Screenshots) als Referenz
```
