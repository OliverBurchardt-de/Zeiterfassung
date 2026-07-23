import { chromium } from 'playwright';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
let failures = 0;
const check = (c, m) => { console.log((c ? 'OK: ' : 'FEHLER: ') + m); if (!c) failures++; };
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));

async function login(name) {
  await p.goto('http://localhost:5173/');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForSelector('text=Demo-Schnellanmeldung', { timeout: 10000 });
  await p.click(`.login__user:has-text("${name}")`);
  await p.waitForSelector('nav >> text=Aufgaben', { timeout: 10000 });
}

// --- Teil 1: S. Wolf sieht seine zugewiesenen Aufgaben ---
await login('S. Wolf');
// Badge: offene mir-zugewiesene Aufgaben (t1, t2, t3 = 3)
const badge = await p.locator('.nav-pill__badge').first().innerText().catch(() => '');
check(badge === '3', `Navigations-Badge zeigt 3 offene Aufgaben (war: "${badge}")`);

await p.click('nav >> text=Aufgaben');
await p.waitForSelector('text=Eigene To-Dos und Aufgaben', { timeout: 6000 });
check((await p.locator('.task__title[value*="Belege Praxis Dr. Wagner"]').count()) === 1, 'Zugewiesene Aufgabe "Belege Praxis Dr. Wagner" erscheint');
check((await p.locator('.task--overdue').count()) >= 1, 'Überfällige Aufgabe ist als überfällig markiert');
check((await p.locator('.task__frist--overdue').count()) >= 1, 'Frist-Chip zeigt "überfällig"');

// --- Teil 2: neue Aufgabe anlegen ---
await p.fill('.task-compose__row input.input', 'E2E Testaufgabe');
await p.click('.task-compose button:has-text("Anlegen")');
await p.waitForTimeout(300);
check((await p.locator('.task__title[value="E2E Testaufgabe"]').count()) === 1, 'Neue Aufgabe wurde angelegt und erscheint in der Liste');

// --- Teil 3: Aufgabe abhaken -> Badge sinkt ---
const badgeVor = Number(await p.locator('.nav-pill__badge').first().innerText().catch(() => '0'));
const ersteCheck = p.locator('.task:not(.task--done) .task__check').first();
await ersteCheck.click();
await p.waitForTimeout(300);
const badgeNach = Number(await p.locator('.nav-pill__badge').first().innerText().catch(() => '0'));
check(badgeNach === badgeVor - 1, `Abhaken senkt den Badge (${badgeVor} -> ${badgeNach})`);
check((await p.locator('.aufgaben__erledigt-head').count()) === 1, 'Abschnitt "Erledigt" erscheint nach dem Abhaken');

// --- Teil 4: Tab "Von mir vergeben" ---
await p.click('.aufgaben__tabs button:has-text("Von mir vergeben")');
await p.waitForTimeout(200);
check((await p.locator('.task__title[value*="Abschreibung Hotel Seeblick"]').count()) === 1, 'Von-mir-vergebene Aufgabe an O. Burchardt erscheint');

// --- Teil 5: To-Do-Bereich im Auftrags-Detail ---
await p.click('nav >> text=Board');
await p.waitForTimeout(400);
const karte = p.locator('.card:has-text("Praxis Dr. Wagner")').first();
if (await karte.count()) {
  await karte.click();
  await p.waitForSelector('text=Aufgaben zu diesem Auftrag', { timeout: 6000 });
  check(true, 'Auftrags-Detail zeigt den Bereich "Aufgaben zu diesem Auftrag"');
  check((await p.locator('.notes-section:has-text("Aufgaben zu diesem Auftrag") .task__title[value*="Belege Praxis"]').count()) === 1, 'Die verknüpfte Aufgabe erscheint im Auftrag');
} else {
  check(false, 'Auftragskarte "Praxis Dr. Wagner" nicht gefunden (Board-Filter?)');
}

await p.screenshot({ path: `${process.env.E2E_OUT ?? '.'}/aufgaben.png` });
check(errors.length === 0, `Keine Seitenfehler (${errors.slice(0, 2).join(' | ')})`);
await b.close();
console.log(failures === 0 ? '\nE2E Aufgaben: ALLE OK' : `\nE2E Aufgaben: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
