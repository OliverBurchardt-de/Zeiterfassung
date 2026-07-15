import { chromium } from 'playwright';

// E2E fuer die Codex-Review-Fixes (frischer Memory-Server vorausgesetzt):
//  A) Manuelle Buchung traegt das ECHTE Tagesdatum (nicht Mock-HEUTE) + "Heute erfasst" zaehlt sie.
//  B) Zeit-Ownership: Partner sieht fremden Eintrag OHNE Freigeben/Loeschen; "Meine Zeiten" filtert.
//  C) Planung im Server-Modus: eigene Auftraege sichtbar (wolf), Admin-Selektor mit echten Bearbeitern.
const dir = process.env.E2E_OUT ?? '.';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });

let failures = 0;
function check(cond, msg) { console.log((cond ? 'OK: ' : 'FEHLER: ') + msg); if (!cond) failures++; }

const errors = [];
const erwartet = (t) => /401|Unauthorized/i.test(t);
p.on('console', (m) => { if (m.type() === 'error' && !erwartet(m.text())) errors.push(m.text()); });
p.on('pageerror', (e) => { if (!erwartet(String(e))) errors.push(String(e)); });

async function login(user) {
  await p.goto('http://localhost:5173/');
  await p.waitForSelector('text=Anmelden');
  await p.fill('input[autocomplete="username"]', user);
  await p.fill('input[autocomplete="current-password"]', 'demo');
  await p.click('button:has-text("Anmelden")');
  await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });
}
async function logout() {
  await p.click('button[title="Abmelden"]').catch(async () => {
    await p.click('button:has-text("Abmelden")');
  });
  await p.waitForSelector('text=Anmelden', { timeout: 8000 });
}

const heuteIso = new Date().toISOString().slice(0, 10);
const heuteDe = new Date(heuteIso).toLocaleDateString('de-DE');

// ---------- A) klein bucht auf 9001 mit echtem Datum ------------------------
await login('klein');
await p.click('.card:has-text("Praxis Dr. Wagner")');
await p.waitForSelector('.modal');
await p.fill('.modal input[placeholder*="Stunden manuell"]', '1,5');
await p.fill('.modal textarea', 'Codex-Fix E2E');
await p.click('.modal .add-row button:has-text("Hinzufügen")');
await p.waitForTimeout(600);

const zeile = p.locator('.modal .times-list .time-entry').first();
const datumText = await zeile.locator('.time-row span').first().textContent();
check(datumText?.trim() === heuteDe, `Buchung traegt echtes Tagesdatum (${datumText?.trim()} == ${heuteDe})`);
check((await p.locator('.sync-banner').count()) === 0, 'Kein Sync-Fehler nach Buchung');
// Eigentuemer sieht die Bedienelemente am eigenen Eintrag
check((await zeile.locator('button:has-text("Freigeben")').count()) === 1, 'Eigentuemer (klein) sieht "Freigeben" am eigenen Eintrag');
await p.click('.modal__close');

// "Heute erfasst" (rechte Spalte) zaehlt die Buchung mit echtem Datum
const todayNum = await p.locator('.panel:has-text("Heute erfasst") .today-num').textContent().catch(() => '');
check((todayNum ?? '').trim() === '1,5', `"Heute erfasst" zaehlt die heutige Buchung (${(todayNum ?? '').trim()} == 1,5)`);

// "Meine Zeiten": Eintrag da (Ownership-Filter positiv)
await p.click('.nav-pill:has-text("Meine Zeiten")');
await p.waitForSelector('text=Nicht freigegebene Zeiten');
check((await p.locator('.ctrl-row:has-text("Praxis Dr. Wagner")').count()) >= 1, '"Meine Zeiten" (klein) zeigt den eigenen Eintrag');
await p.screenshot({ path: `${dir}/50-codex-klein.png` });
await logout();

// ---------- B) burchardt (Partner): fremder Eintrag ohne Bedienelemente -----
await login('burchardt');
await p.click('.card:has-text("Praxis Dr. Wagner")');
await p.waitForSelector('.modal');
await p.waitForSelector('.modal .times-list .time-entry', { timeout: 8000 });
const fremd = p.locator('.modal .times-list .time-entry');
check((await fremd.count()) === 1, 'Partner sieht den fremden Eintrag (Transparenz bleibt)');
check((await fremd.locator('button:has-text("Freigeben")').count()) === 0, 'Partner hat KEIN "Freigeben" am fremden Eintrag');
check((await fremd.locator('button[aria-label="Fehlbuchung löschen"]').count()) === 0, 'Partner hat KEIN "Löschen" am fremden Eintrag');
await p.click('.modal__close');

await p.click('.nav-pill:has-text("Meine Zeiten")');
await p.waitForSelector('text=Nicht freigegebene Zeiten');
check((await p.locator('.ctrl-row:has-text("Praxis Dr. Wagner")').count()) === 0, '"Meine Zeiten" (burchardt) zeigt den fremden Eintrag NICHT');

// ---------- C) Planung: Admin-Selektor mit echten Bearbeitern ----------------
await p.click('.nav-pill:has-text("Planung")');
await p.waitForSelector('h1:has-text("Planung")');
const optionen = await p.locator('.verw-head select option').allTextContents();
check(optionen.length >= 2, `Admin-Selektor ist befuellt (${optionen.join(', ')})`);
check(optionen.some((o) => /Wolf/.test(o)) && optionen.some((o) => /Klein/.test(o)),
  'Selektor enthaelt echte Bearbeiter (Wolf, Klein) aus den Auftraegen');
// Auswahl S. Wolf → dessen Auftrag (Hotel Seeblick) erscheint in Pool oder Kalender
const wolfOption = optionen.find((o) => /Wolf/.test(o));
await p.selectOption('.verw-head select', { label: wolfOption });
await p.waitForTimeout(400);
const planungInhalt = await p.locator('.placeholder').textContent();
check(/Hotel Seeblick/.test(planungInhalt ?? ''), 'Planung (Auswahl S. Wolf) zeigt dessen Auftrag Hotel Seeblick');
await p.screenshot({ path: `${dir}/51-codex-planung-admin.png` });
await logout();

// ---------- C2) Planung als Nicht-Admin (wolf): eigene Auftraege -------------
await login('wolf');
await p.click('.nav-pill:has-text("Planung")');
await p.waitForSelector('h1:has-text("Planung")');
const meineInhalt = await p.locator('.placeholder').textContent();
check(/Hotel Seeblick/.test(meineInhalt ?? ''), 'Planung (wolf, Nicht-Admin) zeigt die eigenen Auftraege ueber me.datevId');
await p.screenshot({ path: `${dir}/52-codex-planung-wolf.png` });

check(errors.length === 0, `Keine Konsolenfehler (${errors.slice(0, 3).join(' | ')})`);

await b.close();
console.log(failures === 0 ? '\nE2E Codex-Fixes: ALLE OK' : `\nE2E Codex-Fixes: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
