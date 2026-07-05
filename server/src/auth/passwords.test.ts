import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './passwords';

describe('passwords', () => {
  it('verifiziert das korrekte Passwort und lehnt ein falsches ab', async () => {
    const hash = await hashPassword('geheim');
    expect(hash).not.toBe('geheim');
    expect(await verifyPassword('geheim', hash)).toBe(true);
    expect(await verifyPassword('falsch', hash)).toBe(false);
  });
});
