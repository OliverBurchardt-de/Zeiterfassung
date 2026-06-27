# Konzept: Mandanten-Reporting via Power BI (Burchardt & Kollegen)

> Stand: Diskussions-/Konzeptphase. Dieses Dokument fasst den bisher besprochenen
> Lösungsweg zusammen und markiert die noch offenen Entscheidungen. Es ist bewusst
> auch für Nicht-Techniker verständlich gehalten.
>
> Hinweis: Dieses Konzept beschreibt ein **eigenständiges Projekt**. Es liegt hier
> nur vorübergehend im Zeiterfassungs-Repo und ist dafür vorgesehen, in ein eigenes,
> neues Repository übernommen zu werden.

## 1. Ziel des Projekts

Eine **App für unsere Mandanten**, in der sie ihre **Accounting-/Buchhaltungszahlen
grafisch aufbereitet** sehen — als Dashboards mit **KPIs**, **Drilldowns** (tiefer
reinklicken bis auf einzelne Buchungen) und **Plan/Ist-Vergleichen**. Die Daten
stammen aus **DATEV**, werden automatisiert ausgelesen, aufbereitet und über
**Power BI** an die Mandanten ausgeliefert.

Das Projekt ist eigenständig, knüpft aber an die Erkenntnisse des
Zeiterfassungs-Projekts an — insbesondere daran, **wie Daten aus DATEVconnect
herauskommen**.

## 2. Die Gesamtstrecke (5 Schichten)

Bild: ein Restaurant mit Großmarkt, Vorratskammer, Küche, Koch und Gastraum.

```
[1] EXTRAKTION   On-Prem-Agent im Kanzleinetz holt nächtlich Daten aus DATEVconnect
        │        (DATEV = der Großmarkt)
        ▼
[2] LANDING      Rohdaten unverändert als Dateien je Mandant/Periode ablegen
        │        (die Vorratskammer — Nachvollziehbarkeit / GoBD)
        ▼
[3] WAREHOUSE    Aufbereitetes Datenmodell in PostgreSQL ("Star-Schema")
        │        (die aufgeräumte Küche, aus der schnell "gekocht" werden kann)
        ▼
[4] POWER BI     Datenmodell + KPIs/DAX, Drilldowns, Plan/Ist, Mandantentrennung
        │        (der Koch, der die Teller = Grafiken anrichtet)
        ▼
[5] AUSLIEFERUNG Mandant sieht seine Auswertungen (der Gastraum — siehe Abschnitt 5)
```

## 3. Datenquellen in DATEV (bereits im Zeiterfassungs-Repo vorhanden)

Die passenden DATEVconnect-Schnittstellen liegen als Specs vor. Kernstück:

- **`Accounting Data Exchange`** (B2B, Server-zu-Server — genau für so eine
  Auslese-Strecke gedacht), arbeitet **job-basiert/asynchron**:
  - `sums-and-balances` → **Summen- und Saldenliste (SuSa)** → Basis für
    BWA, GuV, Bilanz-Kennzahlen
  - `account-postings` → **einzelne Buchungssätze** → Grundlage für **Drilldowns**
  - `general-ledger-accounts` → **Sachkontenrahmen (SKR 03/04)**
- **`Accounting`** ergänzend: `accounts-receivable` / `accounts-payable`
  → **OPOS** für Liquiditäts-/Forderungs-KPIs.

Randbedingung: DATEVconnect läuft **on-prem im Kanzleinetz** (Basic Auth, kein
Internet). Die Auslese muss daher dort laufen; Power BI (Cloud) erreicht die Daten
über ein **On-Premises Data Gateway** (kleiner Dienst, nur ausgehend — kein
Firewall-Loch).

## 4. Datenhaltung — Entscheidung: Dateien + PostgreSQL

Zwei Stufen statt einer:

- **Rohdaten als Dateien** ("Vorratskammer"): unveränderte DATEV-Lieferung je
  Mandant/Periode. Vorteil: Original immer nachweisbar (GoBD), nachvollziehbar.
- **PostgreSQL im "Star-Schema"** ("aufgeräumte Küche"): Datenbank, in der die
  Zahlen sternförmig angeordnet sind — in der Mitte die Werte (Buchungen/Salden),
  außen die Nachschlage-Listen (Mandant, Konto, Monat, Kostenstelle). Genau diese
  Anordnung macht **Drilldowns und KPIs schnell und einfach**.

PostgreSQL ist im Kanzlei-Stack ohnehin vorgesehen → wenig Mehraufwand, deutlich
mehr Tragfähigkeit als reine Ordner. Power BI liest **nicht** direkt aus DATEV,
sondern aus diesem aufbereiteten Modell.

> Empfehlung: **Dateien (roh) + PostgreSQL-Star-Schema.** Die reine "nur Ordner"-
> Variante ist einfacher, kippt aber bei Drilldown/KPIs/Plan-Ist.

## 5. Auslieferung an die Mandanten — Optionen

| Kriterium | A) Power BI Embedded | B) SharePoint / M365 | C) Power BI direkt teilen |
|---|---|---|---|
| Mandant braucht eigenen Login? | Nein (Login über unser Portal) | Ja (Gast im M365) | Ja, **Lizenz pro Kopf** |
| Mandantentrennung | RLS, zentral sauber | RLS möglich, Gästepflege | RLS möglich, Lizenzhürde |
| Optik | **unsere Marke** | "Microsoft-Look" | nackte Power-BI-Oberfläche |
| Kosten | Azure-Kapazität (Pauschale, pausierbar) | bestehende M365-Lizenzen | ~10 €/Monat **pro Mandant** |
| Aufwand | höher (Portal + Einbettung) | mittel | niedrig, aber skaliert nicht |
| Eignung | **Endausbau / Profi** | **schneller Pilot** | für Mandanten ungeeignet |

- **C** wird aussortiert (Lizenz pro Mandant → zu teuer/unpraktisch).
- Echte Wahl ist **A vs. B** — und zwar als **Reihenfolge, nicht Entweder-oder**:
  mit **B (SharePoint)** günstig pilotieren, das **Fundament aber "Embedded-fähig"**
  bauen, später ohne Wegwerf-Arbeit auf **A (Embedded)** heben.

> "Embedded-fähig bauen" = Daten + Zugriffsregeln (jeder Mandant sieht nur seine
> Zahlen) von Anfang an so anlegen, dass **beide** Auslieferungswege darauf passen.

## 6. Das fachliche Kernstück

Die eigentliche Wertschöpfung liegt **nicht** in den DAX-Formeln (Standardarbeit),
sondern in:

1. **Mapping `SKR-Konto → Auswertungszeile`** — Kontensalden sauber in die
   BWA-/GuV-/Bilanz-Struktur übersetzen. Einmal zentral pflegen.
2. **Plandaten-Logik** — entweder **importiert** (Excel durch Mandant/Kanzlei)
   oder **automatisch aus der Historie fortgeschrieben** (oder beides).

## 7. Empfehlung in einem Satz

Daten: **Dateien (roh) + PostgreSQL-Star-Schema.**
Auslieferung: **Modell "Embedded-fähig" bauen, via SharePoint pilotieren,
Ziel Power BI Embedded.**
Schwerpunkt der Denkarbeit: **SKR→Auswertung-Mapping + Plandaten.**

## 8. Offene Entscheidungen (noch zu klären)

- [ ] **Mandantenzahl & M365-Status:** Pilot mit 5–10, oder gleich Richtung "alle"?
      Sind Mandanten heute schon (als Gäste) in unserem M365/SharePoint?
- [ ] **Lizenzen:** Power BI Pro / Fabric-Kapazität / Azure-Subscription vorhanden
      oder zu beschaffen?
- [ ] **Berichtsumfang v1:** reicht BWA + Liquidität/OPOS, oder gleich Bilanz/GuV/
      Plan-Ist?
- [ ] **Plandaten:** Mandant/Kanzlei spielt ein (Excel) vs. automatische
      Fortschreibung vs. beides?
- [ ] **Aktualität:** nächtlicher Refresh ausreichend oder untertägig nötig?
- [ ] **Auslieferungsweg:** Start mit B (SharePoint) als Pilot bestätigt? Ziel A
      (Embedded) bestätigt?

## 9. Vorgeschlagene nächste Schritte

1. Offene Entscheidungen aus Abschnitt 8 klären (v. a. Mandantenzahl + Lizenzen).
2. Neues, eigenes Repository für dieses Projekt anlegen.
3. Proof-of-Concept der **Auslese-Strecke** (Accounting Data Exchange → Dateien →
   PostgreSQL) für **einen** Mandanten / ein Wirtschaftsjahr.
4. Erstes **Power-BI-Datenmodell** (Star-Schema) + eine Beispiel-BWA mit Drilldown.
5. Pilot-Auslieferung (SharePoint) an 1–2 Test-Mandanten zur fachlichen Abnahme.
</content>
</invoke>
