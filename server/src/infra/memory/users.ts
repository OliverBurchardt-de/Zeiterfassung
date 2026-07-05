import type { User } from '../../domain/types';
import type { UserRepository } from '../../domain/ports';
import { hashPassword } from '../../auth/passwords';

/**
 * Demo-Nutzer fuer die Entwicklung (In-Memory). Passwort fuer ALLE: "demo" — NUR fuer Dev.
 * In Produktion kommen die Nutzer aus der Datenbank mit echten Passwoertern.
 *
 * `datevEmployeeId` ist BEWUSST verschieden von der App-`id` (App: `u-…`, DATEV: `emp-…`) — so
 * beweisen die Tests, dass die Auftrags-Sichtbarkeit ueber die DATEV-ID abgleicht, nicht ueber die
 * App-ID (Codex-Review P1). Die Mock-Auftraege (datev/mockAdapter.ts) referenzieren dieselben
 * `emp-…`-IDs.
 */
export async function seedDemoUsers(): Promise<User[]> {
  const pw = await hashPassword('demo');
  return [
    { id: 'u-wolf', username: 'wolf', name: 'S. Wolf', role: 'mitarbeiter', admin: false, passwordHash: pw, datevEmployeeId: 'emp-wolf' },
    { id: 'u-klein', username: 'klein', name: 'M. Klein', role: 'mitarbeiter', admin: false, passwordHash: pw, datevEmployeeId: 'emp-klein' },
    { id: 'u-berg', username: 'berg', name: 'T. Berg', role: 'mitarbeiter', admin: false, passwordHash: pw, datevEmployeeId: 'emp-berg' },
    { id: 'u-burchardt', username: 'burchardt', name: 'O. Burchardt', role: 'partner', admin: true, passwordHash: pw, datevEmployeeId: 'emp-burchardt' },
  ];
}

export function createMemoryUserRepository(users: User[]): UserRepository {
  return {
    async findByUsername(username) {
      return users.find((u) => u.username === username);
    },
    async findById(id) {
      return users.find((u) => u.id === id);
    },
    async list() {
      return users;
    },
  };
}
