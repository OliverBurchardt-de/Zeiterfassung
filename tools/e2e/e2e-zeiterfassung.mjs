import { chromium } from 'playwright';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
let failures = 0;
const check = (c, m) => { console.log((c ? 'OK: ' : 'FEHLER: ') + m); if (!c) failures++; };
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));

await p.goto('http://localhost:5173/');
await p.waitForSelector('text=DEMO-SCHNELLANMELDUNG', { timeout: 10000 });
await p.click('text=O. Burchardt');
await p.waitForSelector('text=Auftrags-Board', { timeout: 10000 });

await p.click('nav >> text=Zeiterfassung');
await p.waitForSelector('text=Zeiterfassungs-Board', { timeout: 6000 });
check((await p.locator('.ze__timeline').count()) === 1, 'Timeline gerendert');
check((await p.locator('.ze__day:has-text("Heute")').count()) === 1, 'Tagesauswahl (Heute/Gestern/Vorgestern)');
check((await p.locator('.ze__pal-card').count()) > 0, 'Auftrags-Palette gefüllt');

await p.fill('input[aria-label="Aufträge suchen"]', 'Bäckerei');
await p.waitForTimeout(300);
check(/Bäckerei/i.test(await p.locator('.ze__palette').innerText()), 'Palette-Suche filtert Aufträge');
await p.fill('input[aria-label="Aufträge suchen"]', '');
await p.waitForTimeout(200);

const card = p.locator('.ze__pal-card').first();
const slot = p.locator('.ze__slot').nth(4); // 09:00
const cb = await card.boundingBox(); const sb = await slot.boundingBox();
await p.mouse.move(cb.x + cb.width/2, cb.y + cb.height/2);
await p.mouse.down();
await p.mouse.move(cb.x + 20, cb.y + 20);
await p.mouse.move(sb.x + sb.width/2, sb.y + sb.height/2, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(300);
check((await p.locator('.ze__block--draft').count()) === 1, 'Drag & Drop erzeugt Entwurfs-Block');

await p.locator('.ze__block--draft button[aria-label="länger"]').click();
await p.waitForTimeout(150);
await p.locator('.ze__block--draft button:has-text("Buchen")').click();
await p.waitForTimeout(400);
check((await p.locator('.ze__block--draft').count()) === 0, 'Nach Buchen: kein Entwurf mehr');
check((await p.locator('.ze__block').count()) >= 1, 'Gebuchter Block erscheint in der Timeline');
const summe = await p.locator('.ze__sum-num').innerText();
check(/[1-9]/.test(summe), `Tagessumme aktualisiert (${summe})`);

await p.click('.ze__day:has-text("Gestern")');
await p.waitForTimeout(200);
check((await p.locator('.ze__block').count()) === 0, 'Anderer Tag zeigt eigene (hier: keine) Buchungen');

await p.screenshot({ path: `${process.env.E2E_OUT ?? '.'}/zeiterfassung-board.png` });
check(errors.length === 0, `Keine Seitenfehler (${errors.slice(0,2).join(' | ')})`);
await b.close();
console.log(failures === 0 ? '\nE2E Zeiterfassungs-Board: ALLE OK' : `\nE2E Zeiterfassungs-Board: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
