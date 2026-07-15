# Datenbank-Migrationen

Nummerierte Schema-Deltas für **bestehende** Datenbanken. Neuinstallationen erhalten den
aktuellen Stand direkt aus `../schema.sql`; Migrationen bringen ältere Datenbestände nach.

## Regeln

1. **Eine Änderung = eine Datei**, Name `NNN_kurzbeschreibung.sql` (dreistellig, fortlaufend —
   die Reihenfolge ist der sortierte Dateiname).
2. Jede Migration ist **guarded/idempotent** (`IF COL_LENGTH(...) IS NULL`, `IF OBJECT_ID(...)`),
   damit ein Doppellauf niemals Schaden anrichtet.
3. Eine einmal gepushte Migration wird **nie mehr geändert** — Korrekturen sind eine neue Datei.
4. `../schema.sql` wird bei jeder Migration **mitgezogen** (Neuinstallation = Endstand).

## Anwendung

`npm run db:setup` führt aus: `schema.sql` → alle noch nicht protokollierten Migrationen in
Reihenfolge → Protokoll je Datei in `dbo.schema_migrations` (`id` = Dateiname, `applied_at`).
Bereits protokollierte Dateien werden übersprungen.

## Betrieb (vor Migration auf Produktionsdaten)

- **Backup zuerst:** vollständige Sicherung der App-Datenbank (SSMS: Tasks → Back Up…, oder
  `BACKUP DATABASE [Zeiterfassung] TO DISK = N'...'`). Erst danach `npm run db:setup`.
- **Fehlschlag:** `db:setup` bricht beim ersten Fehler ab; die fehlgeschlagene Migration ist
  dann NICHT protokolliert. Ursache beheben (ggf. Backup zurückspielen), erneut ausführen —
  dank Guards ist der Wiederholungslauf gefahrlos.
- **Prüfung:** vor dem Produktionslauf denselben Stand einmal gegen eine Testdatenbank
  (Kopie/Restore des Backups) laufen lassen.
