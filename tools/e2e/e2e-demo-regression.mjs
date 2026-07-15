import { chromium } from 'playwright';

// Demo-Modus-Regression nach den Codex-Fixes: Buchung landet weiter auf dem Demo-Stichtag
// HEUTE (20.03.2025), Bedienelemente wie bisher (Bearbeiter-Fallback), Planung ueber EMPLOYEES.
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });

let failures = 0;
function check(cond, msg) { console.log((cond ? 'OK: ' : 'FEHLER: ') + msg); if (!cond) failures++; }
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(String(e)));

await p.goto('http://localhost:5174/');
await p.waitForSelector('text=Demo-Schnellanmeldung');

// Als Mitarbeiter S. Wolf anmelden (Schnellanmeldung)
await p.click('.login__user:has-text("S. Wolf")');
await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });

// Erste eigene Karte oeffnen und manuell buchen
await p.click('.card >> nth=0');
await p.waitForSelector('.modal');
const vorher = await p.locator('.modal .times-list .time-entry').count();
await p.fill('.modal input[placeholder*="Stunden manuell"]', '2');
await p.fill('.modal textarea', 'Demo-Regression');
await p.click('.modal .add-row button:has-text("Hinzufügen")');
await p.waitForTimeout(300);
const rows = p.locator('.modal .times-list .time-entry');
check((await rows.count()) === vorher + 1, 'Manuelle Buchung angelegt');
const letzte = rows.nth(vorher);
const datum = (await letzte.locator('.time-row span').first().textContent())?.trim();
check(datum === '20.3.2025', `Buchung liegt auf dem Demo-Stichtag HEUTE (${datum} == 20.3.2025)`);
check((await letzte.locator('button:has-text("Freigeben")').count()) === 1,
  'Freigeben-Button am Eintrag (Demo-Fallback ueber den Auftrags-Bearbeiter)');
await p.click('.modal__close');

// "Heute erfasst" zaehlt die Buchung auf HEUTE mit
const todayNum = (await p.locator('.panel:has-text("Heute erfasst") .today-num').textContent())?.trim();
check(parseFloat((todayNum ?? '0').replace(',', '.')) >= 2, `"Heute erfasst" zaehlt die Buchung mit (${todayNum} h)`);

// Planung als Nicht-Admin: eigener Name, keine Auswahlliste
await p.click('.nav-pill:has-text("Planung")');
await p.waitForSelector('h1:has-text("Planung")');
check((await p.locator('.verw-head select').count()) === 0, 'Planung (Mitarbeiter): keine Auswahlliste');
check((await p.locator('.verw-head input[readonly]').inputValue()) === 'S. Wolf', 'Planung zeigt den eigenen Namen');
const inhaltWolf = await p.locator('.placeholder').textContent();
check((inhaltWolf ?? '').length > 0 && /Kalender/.test(inhaltWolf ?? ''), 'Planung rendert Pool + Kalender');

// Abmelden → als Admin O. Burchardt: Auswahlliste aus den Mock-EMPLOYEES
await p.click('button[title="Abmelden"]').catch(() => p.click('button:has-text("Abmelden")'));
await p.waitForSelector('text=Demo-Schnellanmeldung');
await p.click('.login__user:has-text("O. Burchardt")');
// Nach Re-Login bleibt das zuletzt aktive Modul (Planung) offen — auf die Nav warten, nicht aufs Board.
await p.waitForSelector('.nav-pill:has-text("Planung")', { timeout: 8000 });
await p.click('.nav-pill:has-text("Planung")');
await p.waitForSelector('h1:has-text("Planung")');
const optionen = await p.locator('.verw-head select option').allTextContents();
check(optionen.some((o) => /Wolf/.test(o)), `Planung (Admin): EMPLOYEES-Auswahl wie bisher (${optionen.join(', ')})`);

check(errors.length === 0, `Keine Konsolenfehler (${errors.slice(0, 3).join(' | ')})`);

await b.close();
console.log(failures === 0 ? '\nE2E Demo-Regression: ALLE OK' : `\nE2E Demo-Regression: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
