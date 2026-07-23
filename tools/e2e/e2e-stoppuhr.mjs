import { chromium } from 'playwright';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
let failures = 0;
const check = (c, m) => { console.log((c ? 'OK: ' : 'FEHLER: ') + m); if (!c) failures++; };
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));

async function zumBoard() {
  await p.waitForSelector('nav >> text=Zeiterfassung', { timeout: 10000 });
  await p.click('nav >> text=Zeiterfassung');
  await p.waitForSelector('text=Zeiterfassungs-Board', { timeout: 6000 });
}
// Stoppuhr um `mins` Minuten zurückdatieren (statt echte Minuten zu warten) + neu laden.
async function zurueckdatieren(mins) {
  await p.evaluate((m) => {
    const raw = JSON.parse(localStorage.getItem('bk-zeiterfassung'));
    raw.state.stopwatch.startedAt = Date.now() - m * 60000;
    localStorage.setItem('bk-zeiterfassung', JSON.stringify(raw));
  }, mins);
  await p.reload();
  await zumBoard();
}
async function starte(such) {
  await p.fill('input[aria-label="Aufträge suchen"]', such);
  await p.waitForTimeout(300);
  await p.locator(`.ze__pal-card:has-text("${such}")`).first().locator('.ze__pal-timer').click();
  await p.waitForTimeout(200);
}

// Login (Demo) + Board
await p.goto('http://localhost:5173/');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForSelector('text=Demo-Schnellanmeldung', { timeout: 10000 });
await p.click('.login__user:has-text("S. Wolf")');
await zumBoard();

// 1) Start + Live-Tick
await starte('Praxis');
check((await p.locator('.ze__stopwatch').count()) === 1, 'Stoppuhr-Banner erscheint nach Start');
check((await p.locator('.ze__pal-card.is-running').count()) === 1, 'Laufender Auftrag ist in der Palette markiert');
const c0 = await p.locator('.ze__sw-clock').innerText();
await p.waitForTimeout(2200);
const c1 = await p.locator('.ze__sw-clock').innerText();
check(c0 !== c1, `Uhr tickt live (${c0} -> ${c1})`);

// 2) Buchen: auf 45 Min zurückdatieren, dann Stopp & buchen -> Block erscheint
await zurueckdatieren(45);
check(/00:4[45]:/.test(await p.locator('.ze__sw-clock').innerText()), 'Nach Reload läuft die Stoppuhr weiter (~45 Min.)');
await p.locator('.ze__stopwatch button:has-text("Stopp")').click();
await p.waitForTimeout(300);
check((await p.locator('.ze__stopwatch').count()) === 0, 'Nach "Stopp & buchen" ist das Banner verschwunden');
check((await p.locator('.ze__block:has-text("Praxis Dr. Wagner")').count()) >= 1, 'Gebuchter Block (Praxis) erscheint in der Timeline');

// 3) Wechsel „nacheinander": A (zurückdatiert) läuft, Start B bucht A und startet B
await starte('Praxis');
await zurueckdatieren(20);
await starte('Müller');
check((await p.locator('.ze__block:has-text("Praxis Dr. Wagner")').count()) >= 2, 'Beim Wechsel wurde der laufende Auftrag A gebucht');
check(/Müller/i.test(await p.locator('.ze__stopwatch').innerText()), 'Stoppuhr läuft jetzt für Auftrag B (Müller)');

// 4) Verwerfen beendet ohne Buchung
await p.locator('.ze__stopwatch button:has-text("Verwerfen")').click();
await p.waitForTimeout(200);
check((await p.locator('.ze__stopwatch').count()) === 0, 'Verwerfen beendet die Stoppuhr ohne Buchung');
check((await p.locator('.ze__block:has-text("Müller")').count()) === 0, 'Verworfene Zeit wurde NICHT gebucht');

await p.screenshot({ path: `${process.env.E2E_OUT ?? '.'}/stoppuhr.png` });
check(errors.length === 0, `Keine Seitenfehler (${errors.slice(0, 2).join(' | ')})`);
await b.close();
console.log(failures === 0 ? '\nE2E Stoppuhr: ALLE OK' : `\nE2E Stoppuhr: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
