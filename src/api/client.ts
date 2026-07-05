import type { ApiUser, ApiBoardOrder, ApiTimeEntry, ApiBookTimeInput, ApiWithId, ApiChecklistItem } from './types';

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

  // --- Etappe 2: Schreib-Endpunkte (Zeit) ---------------------------------
  bookTime: (input: ApiBookTimeInput) =>
    request<ApiTimeEntry>('/api/time', { method: 'POST', body: JSON.stringify(input) }),
  releaseTime: (id: string) => request<ApiTimeEntry>(`/api/time/${id}/release`, { method: 'POST' }),
  withdrawTime: (id: string) => request<ApiTimeEntry>(`/api/time/${id}/withdraw`, { method: 'POST' }),
  deleteTime: (id: string) => request<{ ok: boolean }>(`/api/time/${id}`, { method: 'DELETE' }),

  // --- Etappe 2: Schreib-Endpunkte (Status) -------------------------------
  setStatus: (orderId: string, status: string, position?: number) =>
    request<ApiWithId>(`/api/orders/${orderId}/status`, {
      method: 'POST',
      body: JSON.stringify(position === undefined ? { status } : { status, position }),
    }),

  // --- Etappe 2: Schreib-Endpunkte (Review-Notes / Fragen) ----------------
  createNote: (orderId: string, text: string) =>
    request<ApiWithId>(`/api/orders/${orderId}/notes`, { method: 'POST', body: JSON.stringify({ text }) }),
  editNote: (id: string, text: string) =>
    request<ApiWithId>(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) }),
  noteDone: (id: string) => request<ApiWithId>(`/api/notes/${id}/done`, { method: 'POST' }),
  noteReopen: (id: string) => request<ApiWithId>(`/api/notes/${id}/reopen`, { method: 'POST' }),
  noteApprove: (id: string) => request<ApiWithId>(`/api/notes/${id}/approve`, { method: 'POST' }),
  commentNote: (id: string, text: string) =>
    request<ApiWithId>(`/api/notes/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  deleteNote: (id: string) => request<{ ok: boolean }>(`/api/notes/${id}`, { method: 'DELETE' }),

  // --- Etappe 3: Schreib-Endpunkte (Checkliste) ---------------------------
  checkEnsure: (orderId: string, labels: string[]) =>
    request<ApiChecklistItem[]>(`/api/orders/${orderId}/checklist/ensure`, { method: 'POST', body: JSON.stringify({ labels }) }),
  checkAdd: (orderId: string, label: string) =>
    request<ApiWithId>(`/api/orders/${orderId}/checklist`, { method: 'POST', body: JSON.stringify({ label }) }),
  checkToggle: (orderId: string, itemId: string, done: boolean) =>
    request<ApiWithId>(`/api/orders/${orderId}/checklist/${itemId}/done`, { method: 'POST', body: JSON.stringify({ done }) }),
  checkRemove: (orderId: string, itemId: string) =>
    request<{ ok: boolean }>(`/api/orders/${orderId}/checklist/${itemId}`, { method: 'DELETE' }),
};
