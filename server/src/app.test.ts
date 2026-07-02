import { describe, it, expect } from 'vitest';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createMemorySessionStore } from './auth/sessions';
import { seedDemoUsers, createMemoryUserRepository } from './infra/memory/users';
import { createMockDatevAdapter } from './datev/mockAdapter';

async function makeApp() {
  const users = createMemoryUserRepository(await seedDemoUsers());
  return buildApp(
    { ...loadConfig(), nodeEnv: 'test', cookieSecret: 'test-secret-für-tests' },
    {
      sessions: createMemorySessionStore(),
      users,
      datev: createMockDatevAdapter(),
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
