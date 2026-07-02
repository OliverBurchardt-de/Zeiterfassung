import type { ConnectionPool } from 'mssql';
import { sql } from './db';
import type { User, Role } from '../../domain/types';
import type { UserRepository } from '../../domain/ports';

/** DB-Zeile (dbo.users) -> Domaenen-User. Als reine Funktion exportiert (testbar ohne DB). */
export function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    username: String(row.username),
    name: String(row.name),
    role: (row.role === 'partner' ? 'partner' : 'mitarbeiter') as Role,
    admin: row.admin === true || row.admin === 1,
    passwordHash: String(row.password_hash),
    datevEmployeeId: row.datev_employee_id ? String(row.datev_employee_id) : undefined,
  };
}

const COLS = 'id, username, name, role, admin, password_hash, datev_employee_id';

/**
 * UserRepository gegen MS SQL — erfuellt denselben Port wie das Memory-Repo.
 * Nur aktive Nutzer sind anmeldbar/gelistet (Deaktivieren statt Loeschen, s. Lastenheft).
 */
export function createMssqlUserRepository(pool: ConnectionPool): UserRepository {
  return {
    async findByUsername(username) {
      const r = await pool
        .request()
        .input('username', sql.NVarChar(200), username)
        .query(`SELECT ${COLS} FROM dbo.users WHERE username = @username AND active = 1`);
      return r.recordset[0] ? mapUserRow(r.recordset[0]) : undefined;
    },
    async findById(id) {
      const r = await pool
        .request()
        .input('id', sql.NVarChar(64), id)
        .query(`SELECT ${COLS} FROM dbo.users WHERE id = @id AND active = 1`);
      return r.recordset[0] ? mapUserRow(r.recordset[0]) : undefined;
    },
    async list() {
      const r = await pool.request().query(`SELECT ${COLS} FROM dbo.users WHERE active = 1 ORDER BY name`);
      return r.recordset.map(mapUserRow);
    },
  };
}
