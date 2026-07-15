-- Migration 001: Checklisten-Herkunft + Soft-Delete (Review 12.07.2026, P1.2/P1.3)
-- Fuer BESTEHENDE Datenbanken; Neuinstallationen bekommen die Spalten direkt aus schema.sql.
-- Fail-safe-Vorgabe des Reviews: bestehende Punkte ohne eindeutige Herkunft gelten als
-- Pflichtpunkte ('vorlage'), damit keine Pflichtpruefung abgeschwaecht wird.
-- Idempotent: jede Spalte wird nur ergaenzt, wenn sie fehlt.

IF COL_LENGTH(N'dbo.checklist_items', N'herkunft') IS NULL
  ALTER TABLE dbo.checklist_items
    ADD herkunft NVARCHAR(10) NOT NULL CONSTRAINT df_checklist_herkunft DEFAULT 'vorlage';

IF COL_LENGTH(N'dbo.checklist_items', N'deleted_at') IS NULL
  ALTER TABLE dbo.checklist_items ADD deleted_at DATETIME2 NULL;

IF COL_LENGTH(N'dbo.checklist_items', N'deleted_by') IS NULL
  ALTER TABLE dbo.checklist_items ADD deleted_by NVARCHAR(64) NULL;
