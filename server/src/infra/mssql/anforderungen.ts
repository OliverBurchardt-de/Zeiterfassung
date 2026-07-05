import type { ConnectionPool } from 'mssql';
import { sql } from './db';
import type { Anforderung, AnforderungStatus } from '../../domain/types';
import type { AnforderungRepository } from '../../domain/ports';
import { isoDateTime, optionalIsoDateTime, optionalString } from './rows';

/** DB-Zeile (dbo.anforderungen) -> Domaenen-Anforderung. Reine Funktion (testbar ohne DB). */
export function mapAnforderungRow(row: Record<string, unknown>): Anforderung {
  return {
    id: String(row.id),
    mandant: String(row.mandant),
    mandantNr: String(row.mandant_nr),
    ordertype: String(row.ordertype),
    vj: Number(row.vj),
    zeitraum: optionalString(row.zeitraum),
    notiz: String(row.notiz),
    erstelltVon: String(row.erstellt_von),
    erstelltVonId: String(row.erstellt_von_id),
    status: (row.status === 'angelegt' || row.status === 'abgelehnt' ? row.status : 'angefordert') as AnforderungStatus,
    grund: optionalString(row.grund),
    createdAt: isoDateTime(row.created_at),
    erledigtAm: optionalIsoDateTime(row.erledigt_am),
  };
}

const COLS =
  'id, mandant, mandant_nr, ordertype, vj, zeitraum, notiz, erstellt_von, erstellt_von_id, status, grund, created_at, erledigt_am';
// Neueste zuerst (Backoffice-Inbox) — identisch zur Memory-Sortierung.
const ORDER = 'ORDER BY created_at DESC';

export function createMssqlAnforderungRepository(pool: ConnectionPool): AnforderungRepository {
  return {
    async insert(a) {
      await pool
        .request()
        .input('id', sql.NVarChar(64), a.id)
        .input('mandant', sql.NVarChar(200), a.mandant)
        .input('mandant_nr', sql.NVarChar(20), a.mandantNr)
        .input('ordertype', sql.NVarChar(20), a.ordertype)
        .input('vj', sql.Int, a.vj)
        .input('zeitraum', sql.NVarChar(50), a.zeitraum ?? null)
        .input('notiz', sql.NVarChar(sql.MAX), a.notiz)
        .input('erstellt_von', sql.NVarChar(200), a.erstelltVon)
        .input('erstellt_von_id', sql.NVarChar(64), a.erstelltVonId)
        .input('status', sql.NVarChar(20), a.status)
        .input('created_at', sql.DateTime2, new Date(a.createdAt))
        .query(
          `INSERT INTO dbo.anforderungen
             (id, mandant, mandant_nr, ordertype, vj, zeitraum, notiz, erstellt_von, erstellt_von_id, status, created_at)
           VALUES (@id, @mandant, @mandant_nr, @ordertype, @vj, @zeitraum, @notiz, @erstellt_von,
                   @erstellt_von_id, @status, @created_at)`
        );
    },
    async findById(id) {
      const r = await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .query(`SELECT ${COLS} FROM dbo.anforderungen WHERE id = @id`);
      return r.recordset[0] ? mapAnforderungRow(r.recordset[0]) : undefined;
    },
    async list() {
      const r = await pool.request().query(`SELECT ${COLS} FROM dbo.anforderungen ${ORDER}`);
      return r.recordset.map(mapAnforderungRow);
    },
    async listByErsteller(userId) {
      const r = await pool
        .request()
        .input('erstellt_von_id', sql.NVarChar(64), userId)
        .query(`SELECT ${COLS} FROM dbo.anforderungen WHERE erstellt_von_id = @erstellt_von_id ${ORDER}`);
      return r.recordset.map(mapAnforderungRow);
    },
    async update(a) {
      // Veraenderlich ist nur der Bearbeitungs-Ausgang (angelegt/abgelehnt + Grund + Zeitpunkt).
      await pool
        .request()
        .input('id', sql.NVarChar(64), a.id)
        .input('status', sql.NVarChar(20), a.status)
        .input('grund', sql.NVarChar(500), a.grund ?? null)
        .input('erledigt_am', sql.DateTime2, a.erledigtAm ? new Date(a.erledigtAm) : null)
        .query('UPDATE dbo.anforderungen SET status = @status, grund = @grund, erledigt_am = @erledigt_am WHERE id = @id');
    },
  };
}
