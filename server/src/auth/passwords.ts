import bcrypt from 'bcryptjs';

/**
 * Passwort-Hashing ueber eine reine-JS-Bibliothek (bcryptjs) — bewusst ohne native
 * Kompilierung, damit es auf dem gesperrten ASP-Server ohne Build-Werkzeuge laeuft (ADR-07).
 */

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
