import { describe, it, expect } from 'vitest';
import { mapUserRow } from './users';

/** Reiner Mapping-Test (DB-Zeile -> Domaenen-User), ohne Datenbank. */
describe('mapUserRow', () => {
  it('mappt eine vollstaendige Zeile', () => {
    const u = mapUserRow({
      id: 'u-1',
      username: 'burchardt',
      name: 'O. Burchardt',
      role: 'partner',
      admin: true,
      password_hash: '$2a$12$hash',
      datev_employee_id: 'guid-123',
    });
    expect(u).toEqual({
      id: 'u-1',
      username: 'burchardt',
      name: 'O. Burchardt',
      role: 'partner',
      admin: true,
      passwordHash: '$2a$12$hash',
      datevEmployeeId: 'guid-123',
    });
  });

  it('behandelt BIT-Werte (0/1) und fehlende DATEV-ID', () => {
    const u = mapUserRow({
      id: 'u-2',
      username: 'wolf',
      name: 'S. Wolf',
      role: 'mitarbeiter',
      admin: 0,
      password_hash: 'h',
      datev_employee_id: null,
    });
    expect(u.admin).toBe(false);
    expect(u.role).toBe('mitarbeiter');
    expect(u.datevEmployeeId).toBeUndefined();
  });

  it('faellt bei unbekannter Rolle sicher auf mitarbeiter zurueck', () => {
    const u = mapUserRow({ id: 'x', username: 'x', name: 'x', role: 'geschaeftsfuehrer', admin: 1, password_hash: 'h' });
    expect(u.role).toBe('mitarbeiter');
  });
});
