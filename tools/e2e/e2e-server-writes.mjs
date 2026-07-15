import { chromium } from 'playwright';

const dir = process.env.E2E_OUT ?? '.';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });

let failures = 0;
function check(cond, msg) {
  console.log((cond ? 'OK: ' : 'FEHLER: ') + msg);
  if (!cond) failures++;
}

// Konsolenfehler mitschneiden. Die Session-Prüfung beim Start (GET /api/auth/me ohne gültige
// Session) liefert bewusst 401 → das ist KEIN Fehler, sondern der Weg zum Login-Screen; filtern.
const consoleErrors = [];
const istErwartet = (t) => /401|Unauthorized/i.test(t);
p.on('console', (m) => { if (m.type() === 'error' && !istErwartet(m.text())) consoleErrors.push(m.text()); });
p.on('pageerror', (e) => { if (!istErwartet(String(e))) consoleErrors.push(String(e)); });

// 1) Echter Server-Login (Benutzername/Passwort)
await p.goto('http://localhost:5173/');
await p.waitForSelector('text=Anmelden');
await p.fill('input[autocomplete="username"]', 'wolf');
await p.fill('input[autocomplete="current-password"]', 'demo');
await p.click('button:has-text("Anmelden")');
await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });
check(true, 'Server-Login als wolf erfolgreich, Board geladen');

// 2) Wolfs Auftrag öffnen (Hotel Seeblick KG, Order 9993, Lohn)
await p.click('.card:has-text("Hotel Seeblick")');
await p.waitForSelector('.modal');

const uniqueNote = `E2E-Notiz ${Date.now()}`;

// 3) Manuelle Zeit buchen (2 Stunden)
await p.fill('.modal .add-row input', '2');
await p.click('.modal .add-row button:has-text("Hinzufügen")');
await p.waitForTimeout(400);
const erfasstNach = await p.locator('.modal .time-entry:has-text("Erfasst")').count();
check(erfasstNach >= 1, 'Manuelle Zeit gebucht, erscheint als „Erfasst“');

// 4) Zeit freigeben
await p.click('.modal .time-entry button:has-text("Freigeben")');
await p.waitForTimeout(400);
check((await p.locator('.modal .time-entry:has-text("Freigegeben")').count()) >= 1, 'Zeit freigegeben (erfasst → freigegeben)');

// 5) Notiz/Frage anlegen
await p.fill('.modal .note-compose input[placeholder*="Frage"]', uniqueNote);
await p.click('.modal .note-compose button:has-text("Anlegen")');
await p.waitForTimeout(400);
check(await p.locator(`.modal:has-text("${uniqueNote}")`).count() >= 1, 'Notiz angelegt, im Detail sichtbar');

// 6) Status wechseln → „Bearbeitung begonnen“
await p.click('.modal .status-opt:has-text("Bearbeitung begonnen")');
await p.waitForTimeout(400);
check(await p.locator('.modal .status-opt.is-active:has-text("Bearbeitung begonnen")').count() === 1, 'Status auf „Bearbeitung begonnen“ gesetzt');

// Kein Sync-Fehler-Banner bei erfolgreichen Aktionen
check((await p.locator('.sync-banner').count()) === 0, 'Kein Sync-Fehler-Banner nach erfolgreichen Schreibaktionen');

await p.screenshot({ path: `${dir}/30-server-vor-reload.png` });

// 7) SEITE NEU LADEN → apiRestore lädt Board frisch vom Server (Beweis der Persistenz)
await p.reload();
await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });

// Karte sollte jetzt in Spalte „Bearbeitung begonnen“ liegen (Status serverseitig persistiert)
await p.click('.card:has-text("Hotel Seeblick")');
await p.waitForSelector('.modal');
await p.waitForTimeout(300);

check((await p.locator('.modal .time-entry:has-text("Freigegeben")').count()) >= 1,
  'Nach Reload: freigegebene Zeit weiterhin da → serverseitig persistiert');
check((await p.locator(`.modal:has-text("${uniqueNote}")`).count()) >= 1,
  'Nach Reload: Notiz weiterhin da → serverseitig persistiert');
check((await p.locator('.modal .status-opt.is-active:has-text("Bearbeitung begonnen")').count()) === 1,
  'Nach Reload: Status weiterhin „Bearbeitung begonnen“ → serverseitig persistiert');

await p.screenshot({ path: `${dir}/31-server-nach-reload.png` });

// 8) Zurückziehen + Löschen, danach Reload → Eintrag wirklich weg
await p.click('.modal .time-entry button:has-text("Zurückziehen")');
await p.waitForTimeout(300);
await p.click('.modal .time-entry button[aria-label="Fehlbuchung löschen"]');
await p.waitForTimeout(400);
check((await p.locator('.modal .time-entry').count()) === 0, 'Zeit zurückgezogen und gelöscht (lokal weg)');

await p.reload();
await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });
await p.click('.card:has-text("Hotel Seeblick")');
await p.waitForSelector('.modal');
await p.waitForTimeout(300);
check((await p.locator('.modal .time-entry').count()) === 0,
  'Nach Reload: gelöschte Zeit bleibt weg → Löschung serverseitig persistiert');

check(consoleErrors.length === 0, `Keine Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);

await b.close();
console.log(failures === 0 ? '\nE2E Server-Writes: ALLE OK' : `\nE2E Server-Writes: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
