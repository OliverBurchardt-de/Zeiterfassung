# Anleitung: DATEVconnect-Test auf dem ASP-Server (Stufe 1)

> Ziel: **ohne** auf den ASP-Dienstleister zu warten** bestätigen, dass unsere App später
> Auftragsdaten **lesen** und Änderungen **zurückschreiben** kann. Der Test läuft **direkt auf dem
> ASP-Serversystem** (dort ist `localhost` = DATEVconnect). Er braucht **keinen** neuen Server und
> **keine** App — nur das fertige Skript `tools/datev-connect-test.ps1`.
>
> Wer macht's: jemand mit Zugang zum **gehosteten DATEV-Desktop** (ASP) unter dem DATEV-Benutzer —
> typischerweise IT/Admin der Kanzlei oder der DATEV-/ASP-Partner. Technik-Vorwissen kaum nötig.

## Vorab kurz prüfen (einmalig)
Der DATEVconnect-Benutzer braucht die Rechte **„DATEVconnect"** und **„EO comfort connect"**
(Rechteverwaltung). Falls etwas fehlt, zeigt das Skript einen klaren Hinweis (z. B. „DCO10400 →
Bestandsrecht fehlt"). Details/Fehlertabelle: `docs/datev-connect-asp-zugriff.md`.

---

## Schritt 1 — Nur lesen (risikolos)

1. Auf dem **ASP-Server** anmelden (gehosteter DATEV-Desktop), unter dem DATEV-Benutzer.
2. Die Datei **`datev-connect-test.ps1`** auf den Server kopieren (z. B. in einen Ordner `C:\Temp`).
3. **PowerShell** öffnen, in den Ordner wechseln, und ausführen:
   ```
   powershell -ExecutionPolicy Bypass -File .\datev-connect-test.ps1
   ```
4. Erwartung: Das Skript zeigt nacheinander
   - **0)** den Anmeldenamen („Angemeldet als: …"),
   - **1)** „Schnittstelle antwortet.",
   - **2)** die installierten APIs (darunter **order-management**),
   - **3)** „ordertypes geladen." und „orders geladen (Anzahl: …)" mit einer kleinen Tabelle.
5. Aus der Tabelle eine **Auftrags-ID** notieren (Spalte `id`/`order_id`) — am besten von einem
   **unkritischen Test-Auftrag** — für Schritt 2.

*(Variante, falls keine Windows-Anmeldung greift:* `.\datev-connect-test.ps1 -Auth basic` *→ fragt
Benutzer/Passwort ab. Bei HTTPS:* `-BaseUrl "https://localhost:58452/datev/api" -Insecure`*.)*

---

## Schritt 2 — Zurückschreiben testen (reversibel, an einem TEST-Auftrag)

Dieser Test ändert beim Auftrag kurz die **Planstunden** (+1 h), prüft, ob die Änderung greift,
und **setzt sie sofort wieder auf den Originalwert zurück**. Er beweist damit das Rückschreiben,
ohne bleibende Spuren.

```
.\datev-connect-test.ps1 -TestWriteback -OrderId "HIER-DIE-TEST-AUFTRAGS-ID"
```
- Es kommt eine Sicherheitsabfrage („Fortfahren? ja/nein") — mit **ja** bestätigen.
- Erwartung: „Aenderung wurde uebernommen …" **und** „Originalwert wiederhergestellt …".

Optional zusätzlich einen **Teilauftrag** (Monat, z. B. FiBu/Lohn) testen — dieselbe reversible
Mechanik (auf Teilauftragsebene ist `date_work_completed` das Erledigt-Feld):
```
.\datev-connect-test.ps1 -TestWriteback -OrderId "AUFTRAGS-ID" -SuborderId "TEILAUFTRAGS-ID"
```

---

## Schritt 3 — Zeitbuchung testen (optional, NICHT reversibel)

Nur falls gewünscht: bucht **1 Stunde** auf einen Teilauftrag (`expensepostings`). **Wichtig:** Diese
Buchung lässt sich **nicht** über die API löschen — Korrektur nur in **EO Comfort**. Daher nur an
einem Test-Auftrag und danach in EO wieder entfernen.

```
.\datev-connect-test.ps1 -TestExpensePosting -OrderId "ID" -SuborderId "ID" -EmployeeId "MITARBEITER-GUID" -CostPosition "906"
```
- Die **Mitarbeiter-GUID** steht in `master-data/v1/employees` (Feld `id`), die **CostPosition**
  in `…/orders/{id}/costitems` (`accounting_allowed = true`).
- (Dieser Schreibweg wurde am 26.06.2026 bereits erfolgreich verifiziert — Schritt 3 ist nur zur
  Wiederholung/Vollständigkeit.)

---

## Was danach passiert
Am Ende gibt das Skript eine **Zusammenfassung** aus (Anmeldung, Lesen, PUT-Roundtrip …). Bitte
diese Zusammenfassung (oder die ganze Ausgabe) **zurückmelden** — Fehlerzeilen ruhig mitschicken.
Damit ist die fachliche DATEV-Seite des Spikes abgeschlossen; offen bleibt dann nur noch das
**Hosting** der App im ASP-Umfeld (separate Anfrage: `docs/datev-asp-anfrage.md`).

## Wenn etwas klemmt (Kurz-Übersicht)
| Meldung | Bedeutung | Lösung |
|---|---|---|
| 403 / **DCO10400** | Benutzer fehlt das Bestandsrecht | Rechte „DATEVconnect" + „EO comfort connect" erteilen |
| **406** | falscher Accept-Header | setzt das Skript bereits — sollte nicht auftreten |
| **404** | falscher Pfad/Port | Port prüfen: 58454 (HTTP) / 58452 (HTTPS) |
| **EODC20127** | Zeit-Überschneidung bei Buchung | Buchung ohne `Start_time` (macht das Skript bereits) |
| keine Antwort | Dienst/Port/Server | auf dem ASP-Server unter dem DATEV-Benutzer ausführen |

Vollständige Fehlertabelle & Hintergrund: `docs/datev-connect-asp-zugriff.md`.
