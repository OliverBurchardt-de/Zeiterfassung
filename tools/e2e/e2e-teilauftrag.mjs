import { chromium } from 'playwright';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
let failures = 0;
const check = (c, m) => { console.log((c ? 'OK: ' : 'FEHLER: ') + m); if (!c) failures++; };

// Server-Modus: echter Login
await p.goto('http://localhost:5173/');
await p.waitForSelector('text=Anmelden');
await p.fill('input[autocomplete="username"]', 'burchardt');
await p.fill('input[autocomplete="current-password"]', 'demo');
await p.click('button:has-text("Anmelden")');
await p.waitForSelector('text=Auftrags-Board', { timeout: 8000 });

// Karte 9993 (Lohn, Hotel Seeblick): Teilauftrag-Chip zeigt NUR den naechsten offenen (Maerz)
const karte = p.locator('.card:has-text("Hotel Seeblick")');
const kartenText = await karte.innerText();
check(kartenText.includes('Teilauftrag Mär 2026'), `Karte zeigt "Teilauftrag Mär 2026" (naechster offener)`);
check(!kartenText.includes('Jan 2026') && !kartenText.includes('Feb 2026'), 'Erledigte Monate (Jan/Feb) NICHT auf der Karte');
check(!kartenText.includes('Apr 2026'), 'Spaetere offene Monate (Apr) NICHT auf der Karte — nur der naechste');
check(kartenText.includes('Hotel Seeblick KG'), 'Mandanten-Klarname auf der Karte (Server-Modus)');

await p.screenshot({ path: process.env.E2E_OUT ? `${process.env.E2E_OUT}/teilauftrag-karte.png` : 'teilauftrag-karte.png' });
await b.close();
console.log(failures === 0 ? '\nE2E Teilauftrag: ALLE OK' : `\nE2E Teilauftrag: ${failures} FEHLER`);
process.exit(failures === 0 ? 0 : 1);
