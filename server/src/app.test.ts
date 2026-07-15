import { describe, it, expect } from 'vitest';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createMemorySessionStore } from './auth/sessions';
import { seedDemoUsers } from './infra/memory/users';
import { createMemoryRepositories } from './infra/memory/repos';
import { createActions } from './domain/actions';
import { createMockDatevAdapter } from './datev/mockAdapter';

async function makeApp() {
  const repos = createMemoryRepositories(await seedDemoUsers());
  const datev = createMockDatevAdapter();
  return buildApp(
    { ...loadConfig(), nodeEnv: 'test', cookieSecret: 'test-secret-für-tests' },
    {
      sessions: createMemorySessionStore(),
      users: repos.users,
      datev,
      actions: createActions(repos, datev),
    },
  );
}

async function loginCookie(app: Awaited<ReturnType<typeof makeApp>>, username: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });
  const cookie = res.cookies.find((c) => c.name === 'sid');
  return { res, cookieHeader: cookie ? `${cookie.name}=${cookie.value}` : '' };
}

describe('API', () => {
  it('Health antwortet', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('Login mit falschem Passwort -> 401', async () => {
    const app = await makeApp();
    const { res } = await loginCookie(app, 'wolf', 'falsch');
    expect(res.statusCode).toBe(401);
  });

  it('Login -> me -> logout', async () => {
    const app = await makeApp();
    const { res, cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    expect(res.statusCode).toBe(200);
    expect(cookieHeader).not.toBe('');

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieHeader } });
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe('wolf');
    expect(me.json().passwordHash).toBeUndefined();

    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: cookieHeader } });
    expect(logout.statusCode).toBe(200);

    const meAfter = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieHeader } });
    expect(meAfter.statusCode).toBe(401);
  });

  it('Board erfordert Login', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/board' });
    expect(res.statusCode).toBe(401);
  });

  it('Mitarbeiter sieht nur eigene Auftraege (ohne interne)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const res = await app.inject({ method: 'GET', url: '/api/board', headers: { cookie: cookieHeader } });
    expect(res.statusCode).toBe(200);
    const ids = (res.json() as Array<{ id: string }>).map((o) => o.id);
    expect(ids).toEqual(['9993']);
  });

  it('Admin sieht alle Board-Auftraege', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'burchardt', 'demo');
    const res = await app.inject({ method: 'GET', url: '/api/board', headers: { cookie: cookieHeader } });
    const ids = (res.json() as Array<{ id: string }>).map((o) => o.id);
    expect(ids).toEqual(['9993', '9001']);
  });

  it('Login setzt httpOnly-Session-Cookie mit Ablauf', async () => {
    const app = await makeApp();
    const { res } = await loginCookie(app, 'wolf', 'demo');
    const cookie = res.cookies.find((c) => c.name === 'sid');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.maxAge).toBeGreaterThan(0);
  });

  it('unbekannter Benutzer und falsches Passwort liefern dieselbe Antwort', async () => {
    const app = await makeApp();
    const a = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'gibtsnicht', password: 'x' } });
    const b = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'wolf', password: 'falsch' } });
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
  });
});

describe('Zeit-API', () => {
  it('verlangt Login', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/time', payload: { orderId: 'o1', datum: '2026-07-01', dauer: 1 } });
    expect(res.statusCode).toBe(401);
  });

  it('bucht, listet, gibt frei und loescht eigene Zeit', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const h = { cookie: cookieHeader };

    const book = await app.inject({ method: 'POST', url: '/api/time', headers: h, payload: { orderId: '9993', datum: '2026-07-01', dauer: 2 } });
    expect(book.statusCode).toBe(201);
    const id = book.json().id as string;
    expect(book.json().status).toBe('erfasst');

    // Gelesen wird ueber das Board-Aggregat: die Buchung haengt am Auftrag 9993.
    const board = await app.inject({ method: 'GET', url: '/api/board', headers: h });
    const o = (board.json() as Array<{ id: string; times: unknown[] }>).find((x) => x.id === '9993');
    expect(o?.times.length).toBe(1);

    const rel = await app.inject({ method: 'POST', url: `/api/time/${id}/release`, headers: h });
    expect(rel.json().status).toBe('freigegeben');

    // Loeschen nur im Status 'erfasst' (Review 12.07., P1.1): freigegeben -> 409 …
    const delGesperrt = await app.inject({ method: 'DELETE', url: `/api/time/${id}`, headers: h });
    expect(delGesperrt.statusCode).toBe(409);

    // … erst nach Zuruecknahme der Freigabe ist Loeschen erlaubt.
    await app.inject({ method: 'POST', url: `/api/time/${id}/withdraw`, headers: h });
    const del = await app.inject({ method: 'DELETE', url: `/api/time/${id}`, headers: h });
    expect(del.statusCode).toBe(200);
  });

  it('weist fremde Zeit ab (403)', async () => {
    const app = await makeApp();
    const wolf = await loginCookie(app, 'wolf', 'demo');
    const klein = await loginCookie(app, 'klein', 'demo');
    const book = await app.inject({ method: 'POST', url: '/api/time', headers: { cookie: wolf.cookieHeader }, payload: { orderId: '9993', datum: '2026-07-01', dauer: 1 } });
    const id = book.json().id as string;
    const rel = await app.inject({ method: 'POST', url: `/api/time/${id}/release`, headers: { cookie: klein.cookieHeader } });
    expect(rel.statusCode).toBe(403);
  });

  it('weist ungueltige Dauer ab (400)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const res = await app.inject({ method: 'POST', url: '/api/time', headers: { cookie: cookieHeader }, payload: { orderId: '9993', datum: '2026-07-01', dauer: 0 } });
    expect(res.statusCode).toBe(400);
  });

  it('weist Eingabegrenz-Verstoesse mit 400 ab, bevor die DB sie sieht (Review P2.4)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const h = { cookie: cookieHeader };
    const faelle = [
      { payload: { orderId: '9993', datum: '2026-02-30', dauer: 1 }, grund: 'kein echter Kalendertag' },
      { payload: { orderId: '9993', datum: '2026-07-01', dauer: 12.5 }, grund: 'mehr als die 12-h-Tagesgrenze' },
      { payload: { orderId: '9993', datum: '2026-07-01', dauer: 1.001 }, grund: 'zu feine Bruchteile' },
      { payload: { orderId: '9993', datum: '2026-07-01', dauer: 1, notiz: 'x'.repeat(5000) }, grund: 'Notiz zu lang' },
    ];
    for (const f of faelle) {
      const res = await app.inject({ method: 'POST', url: '/api/time', headers: h, payload: f.payload });
      expect(res.statusCode, f.grund).toBe(400);
    }
    // Note-Text und Checklisten-Label zu lang -> 400; negative Board-Position -> 400.
    const note = await app.inject({ method: 'POST', url: '/api/orders/9993/notes', headers: h, payload: { text: 'x'.repeat(5000) } });
    expect(note.statusCode).toBe(400);
    const label = await app.inject({ method: 'POST', url: '/api/orders/9993/checklist', headers: h, payload: { label: 'x'.repeat(600) } });
    expect(label.statusCode).toBe(400);
    const pos = await app.inject({ method: 'POST', url: '/api/orders/9993/status', headers: h, payload: { status: 'bb', position: -1 } });
    expect(pos.statusCode).toBe(400);
    const ensure = await app.inject({ method: 'POST', url: '/api/orders/9993/checklist/ensure', headers: h, payload: { labels: ['ok', 'x'.repeat(600)] } });
    expect(ensure.statusCode).toBe(400);
  });
});

describe('Note-API', () => {
  it('Mitarbeiter legt Frage an, Partner gibt Review frei', async () => {
    const app = await makeApp();
    const wolf = await loginCookie(app, 'wolf', 'demo');
    const chef = await loginCookie(app, 'burchardt', 'demo');

    const frage = await app.inject({ method: 'POST', url: '/api/orders/9993/notes', headers: { cookie: wolf.cookieHeader }, payload: { text: 'Beleg fehlt' } });
    expect(frage.statusCode).toBe(201);
    expect(frage.json().kind).toBe('frage');

    const review = await app.inject({ method: 'POST', url: '/api/orders/9993/notes', headers: { cookie: chef.cookieHeader }, payload: { text: 'Bitte pruefen' } });
    const rid = review.json().id as string;
    expect(review.json().kind).toBe('review');

    // Mitarbeiter meldet erledigt, Partner gibt frei
    await app.inject({ method: 'POST', url: `/api/notes/${rid}/done`, headers: { cookie: wolf.cookieHeader } });
    const appr = await app.inject({ method: 'POST', url: `/api/notes/${rid}/approve`, headers: { cookie: chef.cookieHeader } });
    expect(appr.json().noteState).toBe('freigegeben');

    // Gelesen wird ueber das Board-Aggregat: beide Notes haengen am Auftrag 9993.
    const board = await app.inject({ method: 'GET', url: '/api/board', headers: { cookie: wolf.cookieHeader } });
    const o = (board.json() as Array<{ id: string; notes: unknown[] }>).find((x) => x.id === '9993');
    expect(o?.notes.length).toBe(2);
  });

  it('Mitarbeiter darf Review nicht freigeben (403)', async () => {
    const app = await makeApp();
    const wolf = await loginCookie(app, 'wolf', 'demo');
    const chef = await loginCookie(app, 'burchardt', 'demo');
    const review = await app.inject({ method: 'POST', url: '/api/orders/9993/notes', headers: { cookie: chef.cookieHeader }, payload: { text: 'Review' } });
    const rid = review.json().id as string;
    await app.inject({ method: 'POST', url: `/api/notes/${rid}/done`, headers: { cookie: wolf.cookieHeader } });
    const appr = await app.inject({ method: 'POST', url: `/api/notes/${rid}/approve`, headers: { cookie: wolf.cookieHeader } });
    expect(appr.statusCode).toBe(403);
  });
});

describe('Status-API', () => {
  it('setzt Status', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const h = { cookie: cookieHeader };
    const set = await app.inject({ method: 'POST', url: '/api/orders/9993/status', headers: h, payload: { status: 'bb' } });
    expect(set.statusCode).toBe(200);
    expect(set.json().boardStatus).toBe('bb');
  });

  it('weist unbekannten Status ab (400)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const res = await app.inject({ method: 'POST', url: '/api/orders/9993/status', headers: { cookie: cookieHeader }, payload: { status: 'xx' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('Checklist-API (Herkunft + Soft-Delete, Review 12.07.)', () => {
  it('Vorlagenpunkt (ensure) ist nicht loeschbar (409), manueller Punkt schon (200)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const h = { cookie: cookieHeader };

    // Vorlage instanziieren -> Pflichtpunkt
    const ens = await app.inject({ method: 'POST', url: '/api/orders/9993/checklist/ensure', headers: h, payload: { labels: ['Pflicht'] } });
    expect(ens.statusCode).toBe(200);
    const pflicht = (ens.json() as Array<{ id: string; herkunft: string }>)[0];
    expect(pflicht.herkunft).toBe('vorlage');

    // Manuell ergaenzen -> loeschbar
    const add = await app.inject({ method: 'POST', url: '/api/orders/9993/checklist', headers: h, payload: { label: 'Zusatz' } });
    expect(add.statusCode).toBe(201);
    expect(add.json().herkunft).toBe('manuell');

    const delPflicht = await app.inject({ method: 'DELETE', url: `/api/orders/9993/checklist/${pflicht.id}`, headers: h });
    expect(delPflicht.statusCode).toBe(409);

    const delZusatz = await app.inject({ method: 'DELETE', url: `/api/orders/9993/checklist/${add.json().id}`, headers: h });
    expect(delZusatz.statusCode).toBe(200);

    // Board zeigt nur den aktiven Pflichtpunkt — der geloeschte manuelle taucht nicht mehr auf.
    const board = await app.inject({ method: 'GET', url: '/api/board', headers: h });
    const o = (board.json() as Array<{ id: string; checklist: Array<{ id: string }> }>).find((x) => x.id === '9993');
    expect(o?.checklist.map((c) => c.id)).toEqual([pflicht.id]);
  });
});

describe('IDOR-Schutz: Auftrags-Sichtbarkeit auf allen Fach-Routen', () => {
  // Mock-DATEV: 9993 gehoert wolf, 9001 gehoert klein; beide Partner burchardt (Admin sieht beide).
  it('Mitarbeiter kommt nicht an Notes/Status eines fremden Auftrags (404)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'klein', 'demo'); // klein != Bearbeiter von 9993
    const h = { cookie: cookieHeader };
    const paths = [
      { method: 'POST' as const, url: '/api/orders/9993/notes', payload: { text: 'x' } },
      { method: 'POST' as const, url: '/api/orders/9993/status', payload: { status: 'bb' } },
    ];
    for (const p of paths) {
      const res = await app.inject({ method: p.method, url: p.url, headers: h, payload: p.payload });
      expect(res.statusCode, `${p.method} ${p.url}`).toBe(404);
    }
  });

  it('Zeit kann nicht auf einen fremden Auftrag gebucht werden (404)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'klein', 'demo');
    const res = await app.inject({ method: 'POST', url: '/api/time', headers: { cookie: cookieHeader }, payload: { orderId: '9993', datum: '2026-07-01', dauer: 1 } });
    expect(res.statusCode).toBe(404);
  });

  it('interner Auftrag ist auch fuer den Admin nicht bebuchbar (404)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'burchardt', 'demo');
    const res = await app.inject({ method: 'POST', url: '/api/orders/8476/status', headers: { cookie: cookieHeader }, payload: { status: 'bb' } });
    expect(res.statusCode).toBe(404);
  });

  it('positive Kontrolle: auf dem EIGENEN Auftrag ist der Zugriff erlaubt', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'klein', 'demo'); // klein IST Bearbeiter von 9001
    const res = await app.inject({ method: 'POST', url: '/api/orders/9001/status', headers: { cookie: cookieHeader }, payload: { status: 'bb' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().boardStatus).toBe('bb');
  });
});

describe('Board-API', () => {
  it('verlangt Login', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/board' });
    expect(res.statusCode).toBe(401);
  });

  it('liefert das Aggregat nur fuer sichtbare Auftraege (Mitarbeiter)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const res = await app.inject({ method: 'GET', url: '/api/board', headers: { cookie: cookieHeader } });
    expect(res.statusCode).toBe(200);
    const board = res.json() as Array<Record<string, unknown>>;
    expect(board.map((o) => o.id)).toEqual(['9993']);
    // Aggregat-Form: Zusatzdaten und aufgeloeste Namen sind enthalten
    expect(board[0].times).toEqual([]);
    expect(board[0].notes).toEqual([]);
    expect(board[0].checklist).toEqual([]);
    expect(board[0].umplanungenVerbraucht).toBe(0);
    expect(board[0].responsibleName).toBe('S. Wolf');
    expect(board[0].partnerName).toBe('O. Burchardt');
    expect(board[0].clientName).toBe('Hotel Seeblick KG');
    expect(board[0].plannedEnd).toBe('2026-03-31');
  });

  it('enthaelt gebuchte Zeiten, Notes samt Autor-Namen und den Board-Status', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const h = { cookie: cookieHeader };

    await app.inject({ method: 'POST', url: '/api/time', headers: h, payload: { orderId: '9993', datum: '2026-07-01', dauer: 1.5 } });
    await app.inject({ method: 'POST', url: '/api/orders/9993/notes', headers: h, payload: { text: 'Beleg fehlt' } });
    await app.inject({ method: 'POST', url: '/api/orders/9993/status', headers: h, payload: { status: 'bb' } });

    const res = await app.inject({ method: 'GET', url: '/api/board', headers: h });
    const order = (res.json() as Array<Record<string, unknown>>)[0];
    expect((order.times as Array<{ dauer: number }>)[0].dauer).toBe(1.5);
    const note = (order.notes as Array<{ text: string; authorName: string; kind: string }>)[0];
    expect(note.text).toBe('Beleg fehlt');
    expect(note.authorName).toBe('S. Wolf');
    expect(note.kind).toBe('frage'); // Mitarbeiter erzeugt Fragen
    expect(order.boardStatus).toBe('bb');
  });

  it('Admin sieht alle Board-Auftraege, interne nie', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'burchardt', 'demo');
    const res = await app.inject({ method: 'GET', url: '/api/board', headers: { cookie: cookieHeader } });
    const ids = (res.json() as Array<{ id: string }>).map((o) => o.id);
    expect(ids).toEqual(['9993', '9001']);
  });
});

describe('Login-Schutz (Review P3.7)', () => {
  it('sperrt nach 5 Fehlversuchen auch das richtige Passwort (429)', async () => {
    const app = await makeApp();
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'wolf', password: 'falsch' } });
      expect(res.statusCode).toBe(401);
    }
    const gesperrt = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'wolf', password: 'demo' } });
    expect(gesperrt.statusCode).toBe(429);
    // Anderer Nutzer von anderer "IP" ist nicht betroffen — inject nutzt dieselbe Quell-IP,
    // daher hier nur der Konto-Schluessel pruefbar: klein ist gesperrt ueber die IP-Sperre?
    // Nein: IP-Sperre greift erst nach 5 IP-Fehlversuchen — die 5 obigen zaehlen auch fuer die
    // IP, also ist die Quelle jetzt ebenfalls gesperrt. Das ist gewollt (eine Quelle, viele Namen).
    const klein = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'klein', password: 'demo' } });
    expect(klein.statusCode).toBe(429);
  });

  it('deaktivierter Nutzer verliert sofort den Zugriff (laufende Session inklusive)', async () => {
    const users = await seedDemoUsers();
    const repos = createMemoryRepositories(users);
    const datev = createMockDatevAdapter();
    const app = buildApp(
      { ...loadConfig(), nodeEnv: 'test', cookieSecret: 'test-secret-für-tests' },
      { sessions: createMemorySessionStore(), users: repos.users, datev, actions: createActions(repos, datev) },
    );
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieHeader } })).statusCode).toBe(200);

    // Deaktivieren — wirkt beim NAECHSTEN Request, ohne dass die Session geloescht werden muss.
    users.find((u) => u.username === 'wolf')!.active = false;
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieHeader } })).statusCode).toBe(401);
    // Auch ein Neu-Login ist nicht moeglich.
    const relogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'wolf', password: 'demo' } });
    expect(relogin.statusCode).toBe(401);
  });
});

describe('Sessions (TTL)', () => {
  it('abgelaufene Session ist ungueltig', async () => {
    const { createMemorySessionStore } = await import('./auth/sessions');
    const store = createMemorySessionStore(-1); // sofort abgelaufen
    const id = store.create('u-wolf');
    expect(store.get(id)).toBeUndefined();
  });
});

describe('Config (Fail-Fast)', () => {
  it('bricht in Produktion ohne COOKIE_SECRET ab', async () => {
    const { loadConfig } = await import('./config');
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.COOKIE_SECRET;
    process.env.NODE_ENV = 'production';
    delete process.env.COOKIE_SECRET;
    try {
      expect(() => loadConfig()).toThrow(/COOKIE_SECRET/);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret !== undefined) process.env.COOKIE_SECRET = prevSecret;
    }
  });
});
