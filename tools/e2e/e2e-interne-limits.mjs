import { chromium } from 'playwright';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
let failures = 0;
const check = (c, m) => { console.log((c ? 'OK: ' : 'FEHLER: ') + m); if (!c) failures++; };
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));

async function login(name) {
  await p.goto('http://localhost:5173/');
  // Demo-Session (localStorage) zurücksetzen, damit der Login-Screen sicher erscheint.
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForSelector('text=Demo-Schnellanmeldung', { timeout: 10000 });
  await p.click(`.login__user:has-text("${name}")`);
  await p.waitForSelector('nav >> text=Zeiterfassung', { timeout: 10000 });
  await p.click('nav >> text=Zeiterfassung');
  await p.waitForSelector('text=Zeiterfassungs-Board', { timeout: 6000 });
}

async function dragKanzleiverwaltung() {
  await p.fill('input[aria-label="Aufträge suchen"]', 'Kanzlei');
  await p.waitForTimeout(300);
  const card = p.locator('.ze__pal-card:has-text("Kanzlei")').first();
  check((await card.count()) > 0, 'Kanzleiverwaltung erscheint in der Palette (interner Auftrag bebuchbar)');
  const slot = p.locator('.ze__slot').nth(4); // 09:00
  const cb = await card.boundingBox(); const sb = await slot.boundingBox();
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await p.mouse.down();
  await p.mouse.move(cb.x + 20, cb.y + 20);
  await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  check((await p.locator('.ze__block--draft').count()) === 1, 'Drag & Drop erzeugt Entwurf für Kanzleiverwaltung');
}

// --- Teil 1: Mitarbeiter S. Wolf (kvLimitMin = 45): Hinweis bei > 45 Min. ---
await login('S. Wolf');
check((await p.locator('.ze__days select').count()) === 0, 'Mitarbeiter hat KEINE Mitarbeiter-Auswahl');
await dragKanzleiverwaltung();
// 0,5 h -> bei 45-Min-Limit noch kein Hinweis
check((await p.locator('.ze__kv-warn').count()) === 0, 'Bei 0,5 h (30 Min.) noch kein Kanzleiverwaltung-Hinweis');
await p.locator('.ze__block--draft button[aria-label="länger"]').click(); // 0,75 h = 45 Min
await p.locator('.ze__block--draft button[aria-label="länger"]').click(); // 1,0 h = 60 Min
await p.waitForTimeout(150);
check((await p.locator('.ze__kv-warn').count()) === 1, 'Über 45 Min.: Kanzleiverwaltung-Hinweis erscheint');
check(/Begründung und Genehmigung/i.test(await p.locator('.ze__kv-warn').innerText()), 'Hinweistext nennt Begründung/Genehmigung');
// Buchen ist trotz Hinweis möglich (kein hartes Limit)
await p.locator('.ze__block--draft button:has-text("Buchen")').click();
await p.waitForTimeout(300);
check((await p.locator('.ze__block--draft').count()) === 0, 'Trotz Hinweis gebucht (kein hartes Limit)');
check((await p.locator('.ze__block:has-text("Kanzlei")').count()) >= 1, 'Kanzleiverwaltungs-Buchung erscheint in der Timeline');

// --- Teil 2: Backoffice B. Ostermann: Mitarbeiter-Auswahl + Buchen für andere ---
await login('B. Ostermann');
const sel = p.locator('.ze__days select');
check((await sel.count()) === 1, 'Backoffice hat die Mitarbeiter-Auswahl ("Zeiten erfassen für")');
await sel.selectOption({ label: 'S. Wolf' });
await p.waitForTimeout(200);
check(/Konto von S\. Wolf/i.test(await p.locator('.ze__days').innerText()), 'Hinweis: Buchungen gehen auf das Konto von S. Wolf');
await dragKanzleiverwaltung();
await p.locator('.ze__block--draft button:has-text("Buchen")').click();
await p.waitForTimeout(300);
check((await p.locator('.ze__block:has-text("Kanzlei")').count()) >= 1, 'Backoffice-Buchung für S. Wolf erscheint in dessen Timeline');

await p.screenshot({ path: `${process.env.E2E_OUT ?? '.'}/interne-limits.png` });
check(errors.length === 0, `Keine Seitenfehler (${errors.slice(0, 2).join(' | ')})`);
await b.close();
console.log(failures === 0 ? '\nE2E Interne-Limits: ALLE OK' : `\nE2E Interne-Limits: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
