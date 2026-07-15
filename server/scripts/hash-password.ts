import { createInterface } from 'node:readline';
import { hashPassword } from '../src/auth/passwords';

/**
 * Erzeugt einen bcrypt-Hash fuer ein Passwort — fuer den manuellen Passwort-Reset per SQL,
 * solange es noch keine Nutzer-Verwaltung in der App gibt (Etappe 3). Ablauf siehe
 * README ("Login-Schutz & Passwoerter").
 *
 * Aufruf: npm run hash-password   (fragt das Passwort interaktiv ab — nichts in der
 * Shell-History, nichts in Logs)
 */
async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const passwort = await new Promise<string>((resolve) => rl.question('Neues Passwort: ', resolve));
  rl.close();
  if (passwort.length < 8) {
    console.error('Abgebrochen: mindestens 8 Zeichen (siehe Passwortregeln im README).');
    process.exit(1);
  }
  console.log('\nbcrypt-Hash (fuer dbo.users.password_hash):\n');
  console.log(await hashPassword(passwort));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
