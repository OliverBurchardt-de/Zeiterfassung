import { chromium } from 'playwright';

const dir = process.env.E2E_OUT ?? '.';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });

let failures = 0;
function check(cond, msg) { console.log((cond ? 'OK: ' : 'FEHLER: ') + msg); if (!cond) failures++; }

const errors = [];
const erwartet = (t) => /401|Unauthorized/i.test(t);
p.on('console', (m) => { if (m.type() === 'error' && !erwartet(m.text())) errors.push(m.text()); });
p.on('pageerror', (e) => { if (!erwartet(String(e))) errors.push(String(e)); });

async function login() {
  await p.goto('http://localhost:5173/');
  await p.waitForSelector('text=Anmelden');
  await p.fill('input[autocomplete="username"]', 'burchardt');
  await p.fill('input[autocomplete="current-password"]', 'demo');
  await p.click('button:has-text("Anmelden")');
  await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });
}

// Öffnet Auftrag 9001 (Jahresabschluss, hat eine Vorlagen-Checkliste) und wartet, bis das Seeding
// den Checkliste-Knopf hat erscheinen lassen; dann Flyout öffnen.
async function openChecklist() {
  await p.click('.card:has-text("Praxis Dr. Wagner")');
  await p.waitForSelector('.modal');
  await p.waitForSelector('.modal button:has-text("Checkliste")', { timeout: 8000 });
  await p.click('.modal button:has-text("Checkliste")');
  await p.waitForSelector('.flyout:has-text("Checkliste")');
}

await login();
await openChecklist();

// 1) Vorlage wurde serverseitig instanziiert
const n = await p.locator('.flyout .check-item').count();
check(n >= 3, `Checkliste aus Vorlage geseedet (${n} Punkte)`);

// 1b) Pflichtpunkte aus der Vorlage haben KEINEN Loesch-Knopf (Review 12.07., P1.2)
check(
  (await p.locator('.flyout .check-item button[aria-label="löschen"]').count()) === 0,
  'Vorlagen-Pflichtpunkte ohne Lösch-Knopf'
);

// 2) „Erledigt" ist gesperrt (Button deaktiviert), solange Punkte offen sind
const erlBtn = p.locator('.modal .status-opt:has-text("Erledigt")');
check(await erlBtn.isDisabled(), '„Erledigt" ist gesperrt (Button deaktiviert) bei offener Checkliste');

// 3) Alle Punkte abhaken → dann wird „Erledigt" freigeschaltet
const boxes = p.locator('.flyout .check-item .checkbox');
for (let i = 0; i < n; i++) { await boxes.nth(i).click(); await p.waitForTimeout(250); }
check((await p.locator('.flyout .check-item .checkbox.is-on').count()) === n, 'Alle Punkte abgehakt');
await p.waitForTimeout(500); // Toggles serverseitig festschreiben, bevor „Erledigt"
await p.click('.flyout button[aria-label="Schließen"]');
await p.waitForTimeout(150);
check(await erlBtn.isEnabled(), '„Erledigt" ist nach vollständiger Checkliste freigeschaltet');
await erlBtn.click();
await p.waitForTimeout(500);
check((await p.locator('.modal .status-opt.is-active:has-text("Erledigt")').count()) === 1,
  '„Erledigt" möglich nach vollständiger Checkliste');
check((await p.locator('.sync-banner').count()) === 0, 'Kein Sync-Fehler');

await p.screenshot({ path: `${dir}/40-checklist-vor-reload.png` });

// 4) RELOAD → Persistenz (Seeding ist idempotent, kein Doppel-Seed)
await p.reload();
await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });
await openChecklist();
check((await p.locator('.flyout .check-item').count()) === n, `Nach Reload: weiterhin ${n} Punkte (kein Doppel-Seed) → persistiert`);
check((await p.locator('.flyout .check-item .checkbox.is-on').count()) === n, 'Nach Reload: alle Punkte weiterhin abgehakt → persistiert');
await p.click('.flyout button[aria-label="Schließen"]');
await p.waitForTimeout(150);
check((await p.locator('.modal .status-opt.is-active:has-text("Erledigt")').count()) === 1,
  'Nach Reload: Status weiterhin „Erledigt" → persistiert');

// 5) Punkt hinzufügen → Reload → da; dann entfernen → Reload → weg
await p.click('.modal button:has-text("Checkliste")');
await p.waitForSelector('.flyout:has-text("Checkliste")');
await p.fill('.flyout .add-row input', 'Zusatzpunkt E2E');
await p.click('.flyout .add-row button:has-text("Hinzufügen")');
await p.waitForTimeout(500);
check((await p.locator('.flyout .check-item').count()) === n + 1, 'Punkt hinzugefügt');
await p.reload();
await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });
await openChecklist();
check((await p.locator('.flyout .check-item').count()) === n + 1, 'Nach Reload: hinzugefügter Punkt da → persistiert');
check(
  (await p.locator('.flyout .check-item button[aria-label="löschen"]').count()) === 1,
  'Nur der manuelle Zusatzpunkt hat einen Lösch-Knopf'
);
// den Zusatzpunkt gezielt löschen (letzter in der Liste)
await p.locator('.flyout .check-item:has-text("Zusatzpunkt E2E") button[aria-label="löschen"]').click();
await p.waitForTimeout(500);
await p.reload();
await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });
await openChecklist();
check((await p.locator('.flyout .check-item').count()) === n, 'Nach Reload: gelöschter Zusatzpunkt weg → persistiert');

check(errors.length === 0, `Keine Konsolenfehler (${errors.slice(0, 3).join(' | ')})`);

await b.close();
console.log(failures === 0 ? '\nE2E Checkliste: ALLE OK' : `\nE2E Checkliste: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
