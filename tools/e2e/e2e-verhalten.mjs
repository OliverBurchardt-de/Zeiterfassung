import { chromium } from 'playwright';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
let failures = 0;
const check = (c, m) => { console.log((c ? 'OK: ' : 'FEHLER: ') + m); if (!c) failures++; };
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));

await p.goto('http://localhost:5173/');
// Demo-Schnellanmeldung: als O. Burchardt (Partner+Admin) — sieht alle Aufträge.
await p.waitForSelector('text=DEMO-SCHNELLANMELDUNG', { timeout: 10000 });
await p.click('text=O. Burchardt');
await p.waitForSelector('text=Auftrags-Board', { timeout: 10000 });

// Demo startet als Mitarbeiter — für die Gesamtsicht als Admin/Partner umschalten (Rollen-Switch M1).
// Admin sieht alles: wechsle über die Verwaltung? Einfacher: Rolle-Umschalter in TopBar suchen.
// Board: KEINE sonstigen Arten (701 betriebswirtsch. Beratung, 607 Außenprüfung waren vorher drin)
const boardText = await p.locator('.board').innerText().catch(() => p.locator('body').innerText());
check(!boardText.includes('betriebswirtschaftliche Beratung'), 'Board ohne sonstige Art 701 (betriebswirtschaftl. Beratung)');
check(!boardText.includes('Außenprüfung'), 'Board ohne sonstige Art 607 (Steuerliche Außenprüfung)');
check(!boardText.includes('Mehraufwand'), 'Board ohne laufende Arten (Mehraufwand)');

// Filter-Leiste: keine Auftragsart-Filter für Beratung/Wirtschaft mehr
const sidebar = await p.locator('.col-left').innerText();
check(!/Steuerliche Beratung/.test(sidebar), 'Filterleiste ohne "Steuerliche Beratung"');
check(!/Wirtschaftliche Beratung/.test(sidebar), 'Filterleiste ohne "Wirtschaftliche Beratung"');
check(/Finanzbuchhaltung/.test(sidebar) && /Lohnbuchführung/.test(sidebar), 'Filterleiste zeigt planbare Buckets');

// Buchungen-Modul: laufende + NEU sonstige Sektion
await p.click('nav >> text=Buchungen');
await p.waitForSelector('text=Laufende Buchungen');
check((await p.locator('h2:has-text("Sonstige Aufträge")').count()) === 1, 'Sektion "Sonstige Aufträge" vorhanden');

const pageText = await p.locator('body').innerText();
check(pageText.includes('betriebswirtschaftliche Beratung') || pageText.includes('Außenprüfung'),
  'Sonstige Aufträge (701/607) erscheinen im Buchungs-Modul');

// Suche in Sonstigen
await p.fill('input[aria-label="Sonstige Aufträge durchsuchen"]', 'Außenprüfung');
await p.waitForTimeout(300);
const nachSuche = await p.locator('body').innerText();
check(nachSuche.includes('Außenprüfung') && !nachSuche.includes('betriebswirtschaftliche Beratung'),
  'Suche filtert die sonstigen Aufträge');
await p.fill('input[aria-label="Sonstige Aufträge durchsuchen"]', '');
await p.waitForTimeout(300);

// Zeit auf einen SONSTIGEN Auftrag buchen (Außenprüfung): Panel finden, Dauer eintragen, buchen
const panel = p.locator('.panel:has-text("Außenprüfung")').first();
const dauerInput = panel.locator('input').last();
await dauerInput.fill('1,5');
await panel.locator('button:has-text("Buchen"), button:has-text("Hinzufügen")').first().click();
await p.waitForTimeout(400);
const panelText = await panel.innerText();
check(/1,5|1\.5/.test(panelText) && /Erfasst/i.test(panelText), 'Zeitbuchung auf sonstigen Auftrag angelegt (Erfasst)');

await p.screenshot({ path: `${process.env.E2E_OUT ?? '.'}/verhalten-buchungen.png`, fullPage: false });

check(errors.length === 0, `Keine Seitenfehler (${errors.slice(0, 2).join(' | ')})`);
await b.close();
console.log(failures === 0 ? '\nE2E Verhalten: ALLE OK' : `\nE2E Verhalten: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
