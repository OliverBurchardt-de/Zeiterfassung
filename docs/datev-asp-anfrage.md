# Anfrage an den DATEV-/ASP-Ansprechpartner — DATEVconnect-Zugriff für eine Eigenentwicklung

> Zweck: klären, **wie unsere selbst entwickelte interne App** im DATEV**asp**-Umfeld auf
> DATEVconnect (Order-Management-API) zugreifen darf — lesend **und** zurückschreibend.
> Hintergrund/Technik: `docs/datev-connect-asp-zugriff.md`. Diese Datei ist die **versandfertige
> Anfrage** (E-Mail unten einfach kopieren) plus eine kurze interne Einordnung.

---

## E-Mail (zum Kopieren/Weiterleiten)

**Betreff:** DATEVconnect-Zugriff für eine interne Eigenentwicklung unter DATEVasp — Verbindungsweg & Rechte

Sehr geehrte Damen und Herren,

wir, die Steuerkanzlei **Burchardt & Kollegen**, nutzen DATEV im **DATEVasp**-Betrieb. Wir
entwickeln aktuell eine **interne Web-Anwendung** zur Auftragsabwicklung und Zeiterfassung, die
Auftragsdaten aus **DATEV Eigenorganisation comfort** über **DATEVconnect** (API **Order
Management**) **liest** und ausgewählte Änderungen (Status, Plandaten, Verantwortliche, erfasste
Zeiten) **nach DATEV zurückschreibt**.

Wir haben den Zugriff auf dem ASP-Serversystem bereits erfolgreich getestet: Anmeldung über
DATEVconnect funktioniert, die Order-Management-API liefert Lesedaten, und ein Schreibtest
(Aufwandsbuchung) war erfolgreich. Es handelt sich um eine **Eigenentwicklung für den internen
Gebrauch** (kein Marktplatz-/Drittanbieterprodukt).

Damit unsere App **im Echtbetrieb** auf DATEVconnect zugreifen kann, bitten wir um Klärung der
folgenden Punkte:

**1. Verbindungsweg (wichtigster Punkt).**
Unsere App läuft als eigenständiges Programm auf einem eigenen Server (nicht innerhalb des
gehosteten DATEV-Desktops). Welcher Zugriffsweg auf die DATEVconnect-Schnittstelle im ASP-RZ ist
für eine **Eigenentwicklung** freigegeben — und mit welchen Kosten/Vorlauf?
- a) **„Anbindung Drittanbieter"** im ASP-Umfeld (Art.-Nr. 42595) — ist das auch für eine
  Eigenentwicklung nutzbar oder nur für gelistete Standardlösungen?
- b) **Site-to-Site-VPN / permanente LAN-LAN-Kopplung** zwischen unserem App-Server und dem ASP-RZ.
- c) **Cloud Gateway for DATEVconnect (in DATEVasp)**.
Welche Option empfehlen Sie für unseren Fall, und wie ist der Bestell-/Einrichtungsprozess?

**2. Technischer DATEVconnect-Benutzer.**
Unsere App greift **unbeaufsichtigt server-seitig** zu (kein interaktiver Windows-Login), d. h. wir
benötigen einen **technischen Benutzer mit Basic Auth** und den Rechten **„DATEVconnect"** und
**„EO comfort connect"**. Wie wird ein solcher Benutzer im ASP-Umfeld angelegt und berechtigt?

**3. Lizenz/Freischaltung.**
Bitte bestätigen Sie, dass die benötigten DATEVconnect-Funktionen freigeschaltet sind bzw. welche
Zusatzlizenzen nötig wären — insbesondere für die **Order-Management-API** (GET **und** PUT) sowie
das **Schreiben von Aufwandsbuchungen** (`expensepostings`). Gibt es hier kostenpflichtige Module?

**4. Sofort-Test auf dem ASP-Server.**
Dürfen wir auf dem ASP-Serversystem (gehosteter Desktop) einen kurzen Lese-/Schreibtest an einem
**unkritischen Test-Auftrag** durchführen (PowerShell/Browser)? Falls ja: ist PowerShell dort
verfügbar bzw. wie gehen wir vor?

**5. Technische Eckdaten** für die spätere Anbindung: Basis-URL/Port (HTTPS `:58452`),
Zertifikats-/TLS-Handling und etwaige Firewall-/Freigabe-Schritte.

Für ein kurzes Telefonat oder eine schriftliche Rückmeldung sind wir dankbar. Vielen Dank vorab!

Mit freundlichen Grüßen
Oliver Burchardt
Burchardt & Kollegen

---

## Interne Einordnung (nicht mitsenden)

- **Kernfrage = Punkt 1.** Davon hängt ab, wo unser App-Backend/DATEV-Adapter (M2) läuft. Realistisch
  ist **b) VPN** oder **c) Cloud Gateway**; a) ist meist nur für gelistete Standardprodukte.
- **Der Adapter-Code ist davon unabhängig** — bei jedem Weg ändern sich nur Adresse + Zugangsdaten.
  Deshalb können wir den fachlichen Lese-/Schreibtest (Stufe 1) **schon vor** der Wegentscheidung
  fahren (`tools/datev-connect-test.ps1` direkt auf dem ASP-Server).
- **Keine sensiblen Daten** (Passwörter, GUIDs) in diese Anfrage oder ins Repo aufnehmen.
- Belege/Quellen zu A/B/C und Rechten: `docs/datev-connect-asp-zugriff.md` (§1, §2, §6).
