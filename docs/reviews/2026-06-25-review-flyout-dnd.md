# Eigen-Review III (Flyout & Drag&Drop): Zeiterfassung & Auftragsabwicklung

Stand: 25. Juni 2026
Kontext: M1-Mock-up nach Einbau von (a) Drag&Drop-Fix (`pointerWithin`, ganze Spalte als
Drop-Ziel) und (b) Karten-Flyout für Checkliste/Besonderheiten.
Methodik: Zwei unabhängige Reviews mit eigenem, leerem Kontext (technischer Code-Review +
UI/Fach-Review), zusammengeführt, dedupliziert und im Code gegengeprüft. Ergänzt die früheren
Reviews (`2026-06-22-ui-fachreview.md`, `2026-06-22-eigenreview-claude.md`).

## Kurzfazit
Reifer, in sich konsistenter Prototyp; die Architektur-Leitplanken (Single Source of Truth,
immutable Mutationen, zentrale `notePolicy`, geteilte Bodies, Marken-Tokens, keine Emojis) werden
eingehalten. Das neue Flyout ist funktional gut gebaut (Positionierung, Scroll-Tracking,
Esc/Außenklick). Gefundene Punkte sind Verbesserungen, keine Blocker. Die mit ✅ markierten Punkte
wurden im Zuge dieses Reviews bereits behoben.

---

## 1. Behobene Punkte (✅)

- **✅ 1.1 Timer-Beschriftung falsch** — `OrderCard.tsx` zeigte `{formatTimer(…)} h läuft`, aber
  `formatTimer` liefert `mm:ss` (`art.ts`). „04:30 h" las sich wie 4,5 h. „ h"-Suffix entfernt.
- **✅ 1.2 Flyout-Position bei wachsendem Inhalt** — `CardFlyout` rechnete nur bei
  `[anchorEl, kind]` neu; viele Checklistenpunkte liefen über den unteren Rand. Jetzt
  `ResizeObserver` + `requestAnimationFrame`-Nachmessung.
- **✅ 1.3 Flyout-Accessibility** — Portal-`div` ohne Semantik. Ergänzt: `role="dialog"`,
  `aria-label`, Fokus beim Öffnen ins Panel und beim Schließen zurück auf die Karte; Trigger mit
  `aria-haspopup="dialog"` + `aria-expanded`; Checklisten-Haken als `role="checkbox"` mit
  `aria-checked` und sprechendem `aria-label`.
- **✅ 1.4 Esc-Schließen vereinheitlicht** — `OrderModal` und `QuickTimeDialog` schließen nun per
  `Esc`; sauberes Stacking (Checklisten-/Besonderheiten-Modal schließen zuerst, dann das Detail).
- **✅ 1.5 Performance** — `OrderCard` in `React.memo`, `onClose`/Toggle mit `useCallback`
  stabilisiert (verhindert unnötiges Re-Rendern/Listener-Recycling, v. a. bei laufendem Timer im
  geöffneten Detail).
- **✅ 1.6 Rollen-Begriff** — User-Chip zeigte „Sachbearbeiter", überall sonst „Mitarbeiter" →
  vereinheitlicht.

---

## 2. Offene Entscheidungen (Fach/Konzept — Workshop bzw. M2)

### 2.1 Rollen-Gating nur in der UI (Muss)
Store-Actions (`setStatus`, `approveTime`, `approveUmplanung`, `setNoteState`) prüfen `role` nicht;
für Zeit-/Umplanungs-Freigabe steckt die Regel `role === 'partner'` direkt in den Views
(`TimePanel`, `LaufendeView`, `FreigabenView`) — anders als die vorbildlich zentrale `notePolicy`.
**Vorschlag:** `timePolicy`/`planPolicy` analog `notePolicy` in `src/lib/tokens.ts`; in M2
server-seitig erzwingen.

### 2.2 Umplanung im Partner-Modus (Muss)
`OrderModal` rendert „Freigabe anfordern" rollenunabhängig — ein Partner fordert bei sich selbst
an und sieht danach „Freigabe ausstehend" auf der eigenen Karte. **Vorschlag:** Partner plant
direkt um (`approveUmplanung`/`planOrder`-Pfad), Mitarbeiter fordert an.

### 2.3 Drag&Drop — Drop-Guard und Affordance (Sollte)
`setStatus` prüft beim Drag nicht `hasUnterlagenProzess`; ein Auftrag ohne Unterlagen-Prozess ließe
sich per Drag nach `ua`/`uv` schieben (im Detail-Modal korrekt ausgeblendet). Zudem fehlt während
des Drags eine globale „hier ablegbar"-Andeutung. **Vorschlag:** Drop auf `ua`/`uv` für Arten ohne
Unterlagen-Prozess ablehnen; Drop-Zonen beim Drag dezent andeuten.

### 2.4 „Erledigt"-Sperre wirkt stumm (Sollte)
Drag nach „Erledigt" bei unvollständiger Checkliste öffnet das Detail-Modal, ohne sofort sichtbar
zu machen, *warum* der Drop abgewiesen wurde. **Vorschlag:** kurze Inline-Rückmeldung an der
Zielspalte („Checkliste erst vollständig").

### 2.5 Touch-Robustheit des Flyouts (Sollte)
Die ganze Karte trägt die Drag-Listener und `touch-action: none`; die Flyout-Buttons sind per Touch
schwer vom Ziehen zu trennen. **Vorschlag:** dedizierter Drag-Griff (wie in `PlanungView` mit
`GripVertical`) statt Drag auf der ganzen Karte.

### 2.6 Flyout vs. Modal — bewusste Entscheidung (Sollte)
Gleiche Aufgabe, zwei Interaktionsmuster (Board = Flyout, Detail = Modal). Inhalt ist über
`ChecklistBody`/`BesonderheitenBody` geteilt (gut). **Vorschlag:** entweder Flyout auch im Detail
oder die Trennung bewusst dokumentieren; mindestens Zähler-Anzeige (Besonderheiten) angleichen.

### 2.7 Identität ≠ Rolle — Folgewirkungen (Muss, bekannt aus Eigen-Review II)
- Besonderheiten-Autor immer `CURRENT_USER`, unabhängig von der Rolle (`BesonderheitenBody`).
- Freigaben-Seite zeigt im Mitarbeiter-Modus nur deaktivierte Buttons statt einer Lesesicht.
Beide lösen sich mit echtem Login/Identität in M2; bis dahin im Demo-Rollen-Umschalter inkonsistent.

---

## 3. Kleinere offene Punkte (Nice-to-have)
- Umplanungs-Monatsliste in `OrderModal` hartkodiert (`Jan–Jun 2025`), unabhängig vom
  Planungs-Kalenderhorizont; Default `Apr 2025` willkürlich → dieselbe Monatsquelle wie Planung
  nutzen, aktuellen Monat als Default ausschließen.
- `ohneZeit`/`istNichtAbgerechnet` mit subtilen Definitionsgrenzen (nur `bb/rf/rn` bzw. nur
  freigegebene Zeiten) — in Hint-Texten erläutern bzw. prüfen, ob `er`-Aufträge mit offenen Zeiten
  irgendwo sichtbar sein sollten.
- Note-Komposer zeigt den fremden Typ-Pill deaktiviert (wirkt wie defekter Umschalter) — ggf. nur
  den eigenen Typ als Label.
- Zeitzonen: `new Date().toISOString().slice(0,10)` (UTC) an Tagesgrenzen → in M2 lokale Zeitzone.

---

## 4. Was gut gelöst ist
Zentrale `notePolicy`; geteilte `ChecklistBody`/`BesonderheitenBody` (keine Logikdopplung);
`canComplete`-Sperre an beiden Statuswegen; `approveUmplanung` setzt Monat + Fristen konsistent;
Drag-Overlay-Muster; `pointerWithin` + ganze Spalte als Droppable; durchgängige Marken-Tokens,
keine Emojis, saubere Empty States; Pflicht-Notiz/Aufwandsart bei laufenden Arten konsistent
erzwungen; keine Memory-Leaks (alle Listener werden im Cleanup entfernt).

---

## 5. Empfehlung
Die Punkte aus Abschnitt 1 sind behoben. Abschnitt 2 sind Fach-/Architekturentscheidungen und
gehören in den Fachworkshop, bevor sie gebaut werden — insbesondere 2.1 (zentrale Policy), 2.2
(Umplanung Partner) und 2.7 (Identität ≠ Rolle), die mit den bereits dokumentierten M2-Themen
zusammenhängen.
