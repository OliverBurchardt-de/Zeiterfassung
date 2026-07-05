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
  return buildApp(
    { ...loadConfig(), nodeEnv: 'test', cookieSecret: 'test-secret-für-tests' },
    {
      sessions: createMemorySessionStore(),
      users: repos.users,
      datev: createMockDatevAdapter(),
      actions: createActions(repos),
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

  it('Orders erfordert Login', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/orders' });
    expect(res.statusCode).toBe(401);
  });

  it('Mitarbeiter sieht nur eigene Auftraege (ohne interne)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const res = await app.inject({ method: 'GET', url: '/api/orders', headers: { cookie: cookieHeader } });
    expect(res.statusCode).toBe(200);
    const ids = (res.json() as Array<{ id: string }>).map((o) => o.id);
    expect(ids).toEqual(['9993']);
  });

  it('Admin sieht alle Board-Auftraege', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'burchardt', 'demo');
    const res = await app.inject({ method: 'GET', url: '/api/orders', headers: { cookie: cookieHeader } });
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

    const mine = await app.inject({ method: 'GET', url: '/api/time/mine', headers: h });
    expect((mine.json() as unknown[]).length).toBe(1);

    const rel = await app.inject({ method: 'POST', url: `/api/time/${id}/release`, headers: h });
    expect(rel.json().status).toBe('freigegeben');

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

    const list = await app.inject({ method: 'GET', url: '/api/orders/9993/notes', headers: { cookie: wolf.cookieHeader } });
    expect((list.json() as unknown[]).length).toBe(2);
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
  it('setzt Status und liefert Historie', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const h = { cookie: cookieHeader };
    const set = await app.inject({ method: 'POST', url: '/api/orders/9993/status', headers: h, payload: { status: 'bb' } });
    expect(set.statusCode).toBe(200);
    expect(set.json().boardStatus).toBe('bb');
    const hist = await app.inject({ method: 'GET', url: '/api/orders/9993/status-history', headers: h });
    expect((hist.json() as unknown[]).length).toBe(1);
  });

  it('weist unbekannten Status ab (400)', async () => {
    const app = await makeApp();
    const { cookieHeader } = await loginCookie(app, 'wolf', 'demo');
    const res = await app.inject({ method: 'POST', url: '/api/orders/9993/status', headers: { cookie: cookieHeader }, payload: { status: 'xx' } });
    expect(res.statusCode).toBe(400);
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
