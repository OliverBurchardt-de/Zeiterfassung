-- ============================================================================
-- Zeiterfassung & Auftragsabwicklung — Datenbank-Schema (MS SQL Server)
-- ============================================================================
-- Eigene App-Persistenz: alles, was DATEV nicht abbildet (ADR-04). DATEV-Stamm-
-- daten werden NICHT dupliziert — nur Overlay + eigene Fachdaten.
--
-- IDEMPOTENT: jede Tabelle wird nur angelegt, wenn sie fehlt. Das Skript kann
-- gefahrlos mehrfach laufen (Setup + spaetere Ergaenzungen).
-- Ausfuehrung: npm run db:setup (scripts/db-setup.ts) oder manuell in SSMS.
--
-- Konventionen:
--  - IDs: NVARCHAR(64) (App vergibt UUIDs; DATEV-IDs sind Zahlen/GUIDs als String).
--  - Kein natives Enum in MS SQL -> Status-/Rollenwerte als NVARCHAR mit
--    dokumentiertem Wertebereich (Pruefung in der Domaenen-Schicht).
--  - Freitexte: NVARCHAR(MAX).
--  - Zeitstempel: DATETIME2, Default SYSUTCDATETIME() (UTC; Anzeige lokalisiert die App).
-- ============================================================================

-- Nutzer (eigener Login; DATEV-Mitarbeiter-ID als Mapping zu order_responsible*).
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE dbo.users (
  id                NVARCHAR(64)   NOT NULL CONSTRAINT pk_users PRIMARY KEY,
  username          NVARCHAR(200)  NOT NULL CONSTRAINT uq_users_username UNIQUE,
  email             NVARCHAR(320)  NOT NULL CONSTRAINT uq_users_email UNIQUE,
  name              NVARCHAR(200)  NOT NULL,
  role              NVARCHAR(20)   NOT NULL,              -- 'mitarbeiter' | 'partner'
  admin             BIT            NOT NULL CONSTRAINT df_users_admin DEFAULT 0,
  password_hash     NVARCHAR(200)  NOT NULL,
  datev_employee_id NVARCHAR(64)   NULL,
  tagessoll         DECIMAL(5,2)   NULL,
  tage_pro_woche    INT            NULL,
  active            BIT            NOT NULL CONSTRAINT df_users_active DEFAULT 1,
  created_at        DATETIME2      NOT NULL CONSTRAINT df_users_created DEFAULT SYSUTCDATETIME()
);

-- App-Zusatzdaten je DATEV-Auftrag (Overlay; orderId = DATEV order id als String).
IF OBJECT_ID(N'dbo.order_overlays', N'U') IS NULL
CREATE TABLE dbo.order_overlays (
  order_id               NVARCHAR(64) NOT NULL CONSTRAINT pk_order_overlays PRIMARY KEY,
  board_status           NVARCHAR(4)  NULL,               -- av/ua/uv/bb/rf/rn/fg/am/fa/er
  board_position         INT          NULL,
  -- 1 DATEV-Auftrag traegt genau 1 Veranlagungsjahr -> Zaehler am Auftrag IST der VJ-Zaehler.
  umplanungen_verbraucht INT          NOT NULL CONSTRAINT df_overlay_umpl DEFAULT 0,
  updated_at             DATETIME2    NOT NULL CONSTRAINT df_overlay_upd DEFAULT SYSUTCDATETIME()
);

-- Checklisten-INSTANZ je Auftrag (Done-Status) — Grundlage der serverseitigen
-- Regel "Erledigt erst bei vollstaendiger Checkliste" (canComplete).
-- herkunft: 'vorlage' = Pflichtpunkt (nie loeschbar) | 'manuell' = am Auftrag ergaenzt.
-- Loeschen ist Soft-Delete (deleted_at/deleted_by) — revisionssicher (Review 12.07.2026).
IF OBJECT_ID(N'dbo.checklist_items', N'U') IS NULL
CREATE TABLE dbo.checklist_items (
  id         NVARCHAR(64)  NOT NULL CONSTRAINT pk_checklist_items PRIMARY KEY,
  order_id   NVARCHAR(64)  NOT NULL,
  label      NVARCHAR(500) NOT NULL,
  done       BIT           NOT NULL CONSTRAINT df_checklist_done DEFAULT 0,
  position   INT           NOT NULL CONSTRAINT df_checklist_pos DEFAULT 0,
  herkunft   NVARCHAR(10)  NOT NULL CONSTRAINT df_checklist_herkunft DEFAULT 'vorlage',
  deleted_at DATETIME2     NULL,
  deleted_by NVARCHAR(64)  NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_checklist_order' AND object_id = OBJECT_ID(N'dbo.checklist_items'))
  CREATE INDEX ix_checklist_order ON dbo.checklist_items (order_id);

-- Zeiteintraege (Kern der Zeiterfassung). Status: 'erfasst' | 'freigegeben' | 'uebertragen'.
-- idempotency_key verhindert Dubletten beim nicht-idempotenten DATEV-POST.
IF OBJECT_ID(N'dbo.time_entries', N'U') IS NULL
CREATE TABLE dbo.time_entries (
  id               NVARCHAR(64)  NOT NULL CONSTRAINT pk_time_entries PRIMARY KEY,
  user_id          NVARCHAR(64)  NOT NULL CONSTRAINT fk_time_user REFERENCES dbo.users(id),
  order_id         NVARCHAR(64)  NOT NULL,
  suborder_id      NVARCHAR(64)  NULL,
  work_date        DATE          NOT NULL,                -- DATEV work_date (massgeblich, nicht der Sync-Zeitpunkt)
  hours            DECIMAL(9,2)  NOT NULL,
  note             NVARCHAR(MAX) NULL,
  status           NVARCHAR(20)  NOT NULL,                -- 'erfasst' | 'freigegeben' | 'uebertragen'
  aufwandsart      NVARCHAR(20)  NULL,                    -- 'mehraufwand' | 'dumm'
  cost_position    NVARCHAR(20)  NULL,                    -- DATEV cost_position (Pflicht beim Sync)
  datev_posting_id NVARCHAR(64)  NULL,
  idempotency_key  NVARCHAR(100) NOT NULL CONSTRAINT uq_time_idem UNIQUE,
  created_at       DATETIME2     NOT NULL CONSTRAINT df_time_created DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_time_user' AND object_id = OBJECT_ID(N'dbo.time_entries'))
  CREATE INDEX ix_time_user ON dbo.time_entries (user_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_time_order' AND object_id = OBJECT_ID(N'dbo.time_entries'))
  CREATE INDEX ix_time_order ON dbo.time_entries (order_id);

-- Review-Notes / Fragen (Thread-Kopf). kind: 'frage' | 'review';
-- note_state: 'offen' | 'erledigt' | 'freigegeben'.
IF OBJECT_ID(N'dbo.notes', N'U') IS NULL
CREATE TABLE dbo.notes (
  id         NVARCHAR(64)  NOT NULL CONSTRAINT pk_notes PRIMARY KEY,
  order_id   NVARCHAR(64)  NOT NULL,
  kind       NVARCHAR(10)  NOT NULL,
  note_state NVARCHAR(20)  NOT NULL,
  text       NVARCHAR(MAX) NOT NULL,
  author_id  NVARCHAR(64)  NOT NULL CONSTRAINT fk_notes_author REFERENCES dbo.users(id),
  created_at DATETIME2     NOT NULL CONSTRAINT df_notes_created DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_notes_order' AND object_id = OBJECT_ID(N'dbo.notes'))
  CREATE INDEX ix_notes_order ON dbo.notes (order_id);

-- Kommentare zu Notes.
IF OBJECT_ID(N'dbo.note_comments', N'U') IS NULL
CREATE TABLE dbo.note_comments (
  id         NVARCHAR(64)  NOT NULL CONSTRAINT pk_note_comments PRIMARY KEY,
  note_id    NVARCHAR(64)  NOT NULL CONSTRAINT fk_comment_note REFERENCES dbo.notes(id),
  author_id  NVARCHAR(64)  NOT NULL CONSTRAINT fk_comment_author REFERENCES dbo.users(id),
  text       NVARCHAR(MAX) NOT NULL,
  created_at DATETIME2     NOT NULL CONSTRAINT df_comment_created DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_comment_note' AND object_id = OBJECT_ID(N'dbo.note_comments'))
  CREATE INDEX ix_comment_note ON dbo.note_comments (note_id);

-- Status-Historie (Kanban-Wechsel; Nachvollziehbarkeit + Basis fuer DATEV-Writeback).
IF OBJECT_ID(N'dbo.status_history', N'U') IS NULL
CREATE TABLE dbo.status_history (
  id          NVARCHAR(64) NOT NULL CONSTRAINT pk_status_history PRIMARY KEY,
  order_id    NVARCHAR(64) NOT NULL,
  from_status NVARCHAR(4)  NULL,
  to_status   NVARCHAR(4)  NOT NULL,
  actor_id    NVARCHAR(64) NOT NULL CONSTRAINT fk_status_actor REFERENCES dbo.users(id),
  created_at  DATETIME2    NOT NULL CONSTRAINT df_status_created DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_status_order' AND object_id = OBJECT_ID(N'dbo.status_history'))
  CREATE INDEX ix_status_order ON dbo.status_history (order_id);

-- Outbox: ausstehende Rueckschreibungen nach DATEV (Pull+Outbox, ADR-06).
-- status: 'offen' | 'uebertragen' | 'fehler'; der Sync-Job pollt auf 'offen'.
IF OBJECT_ID(N'dbo.outbox', N'U') IS NULL
CREATE TABLE dbo.outbox (
  id              NVARCHAR(64)  NOT NULL CONSTRAINT pk_outbox PRIMARY KEY,
  kind            NVARCHAR(30)  NOT NULL,                 -- 'order-put' | 'suborder-put' | 'expense-posting'
  payload         NVARCHAR(MAX) NOT NULL,                 -- JSON (Read-Modify-Write-Bodies koennen gross sein)
  idempotency_key NVARCHAR(100) NOT NULL CONSTRAINT uq_outbox_idem UNIQUE,
  status          NVARCHAR(20)  NOT NULL CONSTRAINT df_outbox_status DEFAULT 'offen',
  attempts        INT           NOT NULL CONSTRAINT df_outbox_attempts DEFAULT 0,
  last_error      NVARCHAR(MAX) NULL,
  created_at      DATETIME2     NOT NULL CONSTRAINT df_outbox_created DEFAULT SYSUTCDATETIME(),
  processed_at    DATETIME2     NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_outbox_status' AND object_id = OBJECT_ID(N'dbo.outbox'))
  CREATE INDEX ix_outbox_status ON dbo.outbox (status);

-- Auftrags-Anforderungen (Workflow, kein DATEV-Write — DATEV kennt kein POST /orders).
-- status: 'angefordert' | 'angelegt' | 'abgelehnt'.
IF OBJECT_ID(N'dbo.anforderungen', N'U') IS NULL
CREATE TABLE dbo.anforderungen (
  id              NVARCHAR(64)  NOT NULL CONSTRAINT pk_anforderungen PRIMARY KEY,
  mandant         NVARCHAR(200) NOT NULL,
  mandant_nr      NVARCHAR(20)  NOT NULL,
  ordertype       NVARCHAR(20)  NOT NULL,
  vj              INT           NOT NULL,
  zeitraum        NVARCHAR(50)  NULL,
  notiz           NVARCHAR(MAX) NOT NULL,
  -- Anzeigename + Nutzer-Referenz getrennt: die ID traegt die Sichtbarkeit,
  -- der Name bleibt auch nach Nutzer-Umbenennung lesbar.
  erstellt_von    NVARCHAR(200) NOT NULL,
  erstellt_von_id NVARCHAR(64)  NOT NULL CONSTRAINT fk_anf_ersteller REFERENCES dbo.users(id),
  status          NVARCHAR(20)  NOT NULL CONSTRAINT df_anf_status DEFAULT 'angefordert',
  grund           NVARCHAR(500) NULL,
  created_at      DATETIME2     NOT NULL CONSTRAINT df_anf_created DEFAULT SYSUTCDATETIME(),
  erledigt_am     DATETIME2     NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_anf_ersteller' AND object_id = OBJECT_ID(N'dbo.anforderungen'))
  CREATE INDEX ix_anf_ersteller ON dbo.anforderungen (erstellt_von_id);

-- Mandantenbesonderheiten, period-unabhaengig am Schluessel client_id + ordertype
-- (mehrere Eintraege je Schluessel — Liste mit Autor/Datum; daher Index, kein Unique).
IF OBJECT_ID(N'dbo.besonderheiten', N'U') IS NULL
CREATE TABLE dbo.besonderheiten (
  id         NVARCHAR(64)  NOT NULL CONSTRAINT pk_besonderheiten PRIMARY KEY,
  client_id  NVARCHAR(64)  NOT NULL,
  ordertype  NVARCHAR(20)  NOT NULL,
  text       NVARCHAR(MAX) NOT NULL,
  author     NVARCHAR(200) NOT NULL,
  created_at DATETIME2     NOT NULL CONSTRAINT df_bes_created DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2     NOT NULL CONSTRAINT df_bes_updated DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bes_key' AND object_id = OBJECT_ID(N'dbo.besonderheiten'))
  CREATE INDEX ix_bes_key ON dbo.besonderheiten (client_id, ordertype);

-- Migrations-Protokoll: welche nummerierten Migrationen (db/migrations/*.sql) bereits
-- angewendet wurden. Gefuehrt von scripts/db-setup.ts — NICHT von Hand pflegen.
IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NULL
CREATE TABLE dbo.schema_migrations (
  id         NVARCHAR(200) NOT NULL CONSTRAINT pk_schema_migrations PRIMARY KEY, -- Dateiname, z. B. '001_checklist_herkunft.sql'
  applied_at DATETIME2     NOT NULL CONSTRAINT df_migr_applied DEFAULT SYSUTCDATETIME()
);
