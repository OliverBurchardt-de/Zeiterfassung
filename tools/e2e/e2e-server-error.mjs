import { chromium } from 'playwright';

const dir = process.env.E2E_OUT ?? '.';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });

let failures = 0;
function check(cond, msg) {
  console.log((cond ? 'OK: ' : 'FEHLER: ') + msg);
  if (!cond) failures++;
}

// Login
await p.goto('http://localhost:5173/');
await p.waitForSelector('text=Anmelden');
await p.fill('input[autocomplete="username"]', 'wolf');
await p.fill('input[autocomplete="current-password"]', 'demo');
await p.click('button:has-text("Anmelden")');
await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });

// Nur die Zeitbuchung serverseitig „scheitern" lassen (GET /api/board bleibt echt → Revert klappt).
await p.route('**/api/time', (route) => {
  if (route.request().method() === 'POST') {
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Testfehler simuliert' }) });
  }
  return route.continue();
});

await p.click('.card:has-text("Hotel Seeblick")');
await p.waitForSelector('.modal');

// Buchung, die serverseitig scheitert
await p.fill('.modal .add-row input', '3');
await p.click('.modal .add-row button:has-text("Hinzufügen")');

// Banner erscheint (mit Server-Meldung), und das optimistische Update wird zurückgenommen.
await p.waitForSelector('.sync-banner', { timeout: 4000 });
const bannerText = await p.locator('.sync-banner').innerText();
check(/nicht gespeichert/i.test(bannerText) && /Testfehler simuliert/i.test(bannerText),
  `Fehler-Banner zeigt Server-Meldung: „${bannerText.replace(/\s+/g, ' ').trim()}“`);

await p.waitForTimeout(500);
check((await p.locator('.modal .time-entry').count()) === 0,
  'Optimistische Buchung wurde nach dem Fehler zurückgenommen (Board neu geladen)');

await p.screenshot({ path: `${dir}/32-server-fehler-banner.png` });

// Banner schließen
await p.click('.sync-banner button[aria-label="Schließen"]');
await p.waitForTimeout(200);
check((await p.locator('.sync-banner').count()) === 0, 'Banner lässt sich schließen');

await b.close();
console.log(failures === 0 ? '\nE2E Server-Error: ALLE OK' : `\nE2E Server-Error: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
