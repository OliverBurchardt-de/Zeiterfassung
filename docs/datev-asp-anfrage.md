# Anfrage an den DATEV-/ASP-Ansprechpartner — Hosting unserer App im DATEVasp-Umfeld

> Zweck: klären, **wie unsere selbst entwickelte interne App auf einem Server INNERHALB der
> DATEVasp-Umgebung gehostet** wird (so wie die bei uns bereits laufende **Ingentis Kanzleisuite**),
> damit sie DATEVconnect (Order-Management-API) über `localhost` erreicht — lesend **und**
> zurückschreibend. Externe Wege (VPN/Cloud Gateway) sind **nicht** das Ziel.
> Hintergrund/Technik: `docs/datev-connect-asp-zugriff.md`. Diese Datei ist die **versandfertige
> Anfrage** (E-Mail unten kopieren) plus eine kurze interne Einordnung.

---

## E-Mail (zum Kopieren/Weiterleiten)

**Betreff:** DATEVasp — eigene interne App auf einem Server im ASP-Umfeld hosten (wie Ingentis Kanzleisuite)

Sehr geehrte Damen und Herren,

wir, die Steuerkanzlei **Burchardt & Kollegen**, nutzen DATEV im **DATEVasp**-Betrieb. Wir haben eine
**interne Web-Anwendung** zur Auftragsabwicklung und Zeiterfassung entwickelt, die Auftragsdaten aus
**DATEV Eigenorganisation comfort** über **DATEVconnect** (API **Order Management**) **liest** und
ausgewählte Änderungen (Status, Plandaten, Verantwortliche, erfasste Zeiten) **nach DATEV
zurückschreibt**. Lese- und Schreibzugriff haben wir auf dem ASP-Serversystem bereits erfolgreich
getestet.

Uns ist klar, dass DATEVconnect nur **innerhalb** der ASP-Umgebung über `localhost` erreichbar ist.
Unsere Anwendung soll daher **auf einem Server innerhalb unserer DATEVasp-Umgebung laufen** — **genau
so, wie bei uns bereits die *Ingentis Kanzleisuite* betrieben wird** (eigener Server im ASP-Umfeld,
Bedienung im Browser). Es handelt sich um eine **Eigenentwicklung für den internen Gebrauch** (kein
Marktplatz-/Drittanbieterprodukt).

Bitte helfen Sie uns, den Weg dorthin zu klären:

**1. Bereitstellung eines Servers im ASP-Umfeld.**
Können Sie uns für diese Eigenentwicklung einen **eigenen Server/eine VM innerhalb unserer
DATEVasp-Umgebung** bereitstellen (analog zur Ingentis-Anbindung)? Unter welchem **Modul/Vertrag**
läuft das, und mit welchen **Kosten/Vorlauf**?

**2. Erlaubte Software / Laufzeitumgebung.**
Unsere App benötigt auf dem Server eine **Node.js-Laufzeit**, eine **PostgreSQL-Datenbank** und einen
schlanken Web-Server. Dürfen wir diese Komponenten auf dem ASP-Server installieren/betreiben, oder
gibt es Vorgaben (zugelassene Software, Paketierung, Prüfung)? Welches **Betriebssystem** (Windows
Server-Version) stünde zur Verfügung?

**3. Einspielen und Aktualisieren der App (Deployment & Betrieb).**
Wie spielen wir die Anwendung auf den Server und **aktualisieren** sie später — z. B. per
**RDP-/Remote-Zugang** für uns, oder durch Übergabe eines **Installations-/Update-Pakets** an Sie?
Wer übernimmt **Betriebssystem-Updates, Sicherung (Backup) und Monitoring** des Servers?

**4. DATEVconnect-Zugriff vom App-Server.**
Unsere App greift **unbeaufsichtigt** (als Dienst, ohne interaktiven Windows-Login) auf DATEVconnect
zu. Wir benötigen dafür einen **technischen Zugang** (Basic Auth oder Service-Konto mit SSO) mit den
Rechten **„DATEVconnect"** und **„EO comfort connect"**. Wie wird dieser im ASP-Umfeld eingerichtet?

**5. Zugriff der Mitarbeiter.**
Die Kolleginnen und Kollegen sollen die App **im Browser ihres ASP-Desktops** öffnen (wie bei
Ingentis). Bitte bestätigen Sie, dass das so vorgesehen werden kann.

**6. Lizenz/Freischaltung.**
Bitte bestätigen Sie, dass die benötigten DATEVconnect-Funktionen freigeschaltet sind bzw. welche
Zusatzlizenzen nötig wären — insbesondere **Order Management** (GET **und** PUT) sowie das **Schreiben
von Aufwandsbuchungen** (`expensepostings`).

Für ein kurzes Telefonat oder eine schriftliche Rückmeldung sind wir dankbar. Vielen Dank vorab!

Mit freundlichen Grüßen
Oliver Burchardt
Burchardt & Kollegen

---

## Interne Einordnung (nicht mitsenden)

- **Kernfrage = Punkte 1–3:** ob und wie DATEV eine **Eigenentwicklung** auf einem ASP-Server hostet.
  Die **Ingentis Kanzleisuite** ist unser Präzedenzfall (eigener Server in ASP) — der stärkste Hebel
  im Gespräch. Offen ist v. a., ob eine **Eigenentwicklung** dieselbe Behandlung bekommt wie ein
  gelistetes Partnerprodukt, und wie das **Deployment/Update** praktisch abläuft.
- **Falls DATEV freie Software-Installation einschränkt:** Plan B wäre, den Stack zu „paketieren"
  (z. B. als ein installierbares Bündel) oder die Laufzeit zu vereinfachen. Das klären wir, sobald
  Punkt 2 beantwortet ist — Auswirkung nur auf die Auslieferung, **nicht** auf die App-Logik.
- **Adapter-Code ist unabhängig vom Hosting** — er spricht `localhost` an; es ändern sich nur
  Zugangsdaten/Pfad. Deshalb können wir den fachlichen Lese-/Schreibtest (Stufe 1) bereits jetzt auf
  dem ASP-Server fahren (`tools/datev-connect-test.ps1`).
- **Keine sensiblen Daten** (Passwörter, GUIDs) in diese Anfrage oder ins Repo aufnehmen.
- Belege/Quellen: `docs/datev-connect-asp-zugriff.md` (ASP-Besonderheit, Rechte), `docs/architektur.md`
  (Deployment im ASP-Umfeld).
