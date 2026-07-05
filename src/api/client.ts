import type { ApiUser, ApiBoardOrder } from './types';

/**
 * Dünner HTTP-Client für die Server-API. Same-Origin (Vite-Proxy in Entwicklung,
 * gemeinsamer Host in Produktion) → das httpOnly-Session-Cookie läuft automatisch mit.
 * Fehler werden als ApiError geworfen (status 0 = Server nicht erreichbar).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new ApiError(0, 'Server nicht erreichbar — läuft er? (npm run dev im server-Ordner)');
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // Body war kein JSON — generische Meldung reicht.
    }
    throw new ApiError(res.status, message);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<ApiUser>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<ApiUser>('/api/auth/me'),
  board: () => request<ApiBoardOrder[]>('/api/board'),
};
