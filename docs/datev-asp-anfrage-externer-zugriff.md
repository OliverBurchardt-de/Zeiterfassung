# Anfrage an den ASP-Anbieter — technischer Benutzer + Hostname für DATEVconnect (externer Zugriff)

> Zweck: Nachdem der **externe Zugriff auf DATEVconnect** (von außerhalb der ASP-Umgebung, über die
> Kanzlei-VPN) erfolgreich getestet wurde, brauchen wir für den **Dauerbetrieb** der App zwei Dinge:
> einen **technischen Benutzer ohne 2FA** und einen **DNS-Hostnamen** (statt der internen IP).
> Diese Anfrage ergänzt die Hosting-Anfrage (`docs/datev-asp-anfrage.md`); hier geht es NUR um den
> technischen Zugang. Details/Belege: `docs/datev-connect-handoff.md` §12.

---

## E-Mail (zum Kopieren/Weiterleiten)

**Betreff:** DATEVconnect externer Zugriff — technischer Benutzer + Hostname für unbeaufsichtigten Betrieb

Sehr geehrte Damen und Herren,

vielen Dank, dass Sie den Zugriff auf **DATEVconnect** aus unserem Kanzleinetz (außerhalb der
ASP-Umgebung) freigeschaltet haben. Wir konnten den Zugriff erfolgreich testen — die Verbindung,
die Anmeldung und der Abruf von Daten funktionieren.

Für den **Dauerbetrieb** unserer internen Anwendung, die **unbeaufsichtigt** (als Dienst, ohne
interaktiven Windows-Login und ohne SmartLogin/2FA) auf DATEVconnect zugreift, benötigen wir noch
zwei Dinge:

**1. Technischer Benutzer für DATEVconnect (ohne 2FA).**
Bitte richten Sie einen **eigenen technischen Benutzer / ein Service-Konto** ein, mit dem sich unsere
Anwendung per **Basic Authentication** (Benutzername + festes Kennwort) an DATEVconnect anmelden kann
— also **ohne SmartLogin/2FA**, da eine unbeaufsichtigte Anwendung keine Handy-Bestätigung
durchführen kann. Der Benutzer benötigt die Rechte **„DATEVconnect"** und **„EO comfort connect"**
(Order Management, lesend und schreibend).
Falls ein Basic-Auth-Konto nicht möglich ist: Wäre alternativ ein **Domänen-Servicekonto** möglich,
mit dem der Zugriff per **NTLM** funktioniert?

**2. Fester DNS-Hostname statt IP-Adresse.**
Aktuell erreichen wir den Dienst über die interne IP. Da das TLS-Zertifikat auf einen **Namen**
ausgestellt ist, bitten wir um den **DNS-Hostnamen** des DATEVconnect-Servers, über den wir ihn
(bei bestehender VPN-Verbindung) ansprechen können — damit die Zertifikatsprüfung sauber greift und
wir sie nicht umgehen müssen.

**3. Rückfrage zur Erreichbarkeit.**
Bitte bestätigen Sie kurz, ob der externe Zugriff **dauerhaft** vorgesehen ist (nicht nur zum Test)
und ob er an bestimmte **Quell-IPs / VPN-Verbindungen** gebunden ist, damit wir den Betrieb der App
darauf ausrichten können.

Für eine kurze Rückmeldung sind wir dankbar. Vielen Dank!

Mit freundlichen Grüßen
Oliver Burchardt
Burchardt & Kollegen

---

## Interne Einordnung (nicht mitsenden)

- **Warum technischer Benutzer:** Der Test lief über das persönliche Windows-Konto per NTLM. Für den
  Dauerbetrieb darf die App nicht an ein persönliches Konto/Passwort gebunden sein — sie braucht einen
  eigenen, langlebigen Zugang. **Basic Auth mit technischem Benutzer** ist im Backend am einfachsten
  und robustesten; NTLM mit Servicekonto ist der Rückfallweg.
- **Warum Hostname:** Zugriff über IP scheitert an der Zertifikatsprüfung (Zert. ist auf einen Namen
  ausgestellt, SNI wird bei IP nicht genutzt). Mit Hostnamen entfällt der `-Insecure`-Testtrick.
- **Hosting ist eine separate Frage** (`docs/datev-asp-anfrage.md`): Da der externe Zugriff nun
  funktioniert, ist Hosting **innerhalb** des ASP **nicht mehr zwingend** — die App könnte auch auf
  einem eigenen Server laufen, der per VPN an DATEV kommt. Diese Entscheidung treffen wir separat.
- **Keine sensiblen Daten** (Passwörter, GUIDs, interne IPs) in diese Anfrage aufnehmen.
