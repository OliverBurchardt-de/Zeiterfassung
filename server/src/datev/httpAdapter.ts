import { Agent } from 'node:https';
import type { DatevPort, ExpensePosting } from '../domain/ports';
import type { OrderView } from '../domain/types';
import type { DatevConfig } from '../config';

/**
 * Echter DATEVconnect-Adapter (Order Management v1) — erfuellt denselben DatevPort wie der Schein-
 * Adapter. Mechanik am Echtsystem verifiziert (docs/datev-connect-handoff.md):
 *  - Pflicht-Header `Accept: application/json; charset=utf-8` (sonst 406).
 *  - Basic Auth mit technischem Benutzer (Dauerbetrieb) — s. ASP-Anfrage.
 *  - Lesen: GET /orders (Liste), /orders/{id} (mit eingebetteten suborders).
 *  - Buchen: POST /orders/{orderId}/suborders/{suborderId}/expensepostings (1 h = 1200 units,
 *    KEIN id im Body, nicht idempotent).
 *
 * TLS-Hinweis: In Produktion ueber den **DNS-Hostnamen** ansprechen (gueltiges Zertifikat). Zugriff
 * ueber die IP scheitert an der Zertifikatspruefung — das loesen wir ueber den Hostnamen, nicht ueber
 * das Abschalten der Pruefung im Code.
 */

/** Wandelt ein DATEV-Order-JSON in die interne OrderView (Feld-Referenz §3b). */
export function mapDatevOrder(raw: Record<string, unknown>): OrderView {
  const num = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (v: unknown): string | undefined =>
    v === null || v === undefined ? undefined : String(v);
  // DATEV-Datumsfelder tolerant nach ISO "JJJJ-MM-TT" normalisieren ("2026-03-01T00:00:00"
  // ebenso wie "01.03.2026 00:00:00"); Unbekanntes lieber weglassen als falsch interpretieren.
  const isoDate = (v: unknown): string | undefined => {
    const s = str(v);
    if (!s) return undefined;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
  };

  return {
    id: String(raw.id ?? raw.order_id ?? ''),
    orderNumber: num(raw.order_number) ?? 0,
    creationYear: num(raw.creation_year),
    ordertype: str(raw.ordertype) ?? '',
    name: str(raw.order_name) ?? '',
    status: str(raw.completion_status) ?? '',
    clientId: str(raw.client_id) ?? '',
    responsibleId: str(raw.order_responsible1_id) || undefined,
    partnerId: str(raw.order_partner_id) || undefined,
    isInternal: raw.isinternal === true || raw.isinternal === 'true',
    plannedHours: num(raw.planned_hours) ?? 0,
    assessmentYear: num(raw.assessment_year),
    billingStatus: str(raw.billing_status) || undefined,
    plannedStart: isoDate(raw.planned_start),
    plannedEnd: isoDate(raw.planned_end),
    // clientName/clientNumber kommen aus den Client Master Data (eigener Lookup, spaeterer
    // M2-Schritt) — hier bewusst leer; das Frontend faellt auf die clientId zurueck.
  };
}

/** Zerlegt "DOMAIN\benutzer" in Domaene + Benutzername (fuer NTLM). Ohne Backslash: nur Benutzer. */
export function splitDomainUser(user: string): { domain: string; username: string } {
  const i = user.indexOf('\\');
  return i === -1
    ? { domain: '', username: user }
    : { domain: user.slice(0, i), username: user.slice(i + 1) };
}

export function createHttpDatevAdapter(cfg: DatevConfig): DatevPort {
  const base = cfg.baseUrl.replace(/\/$/, '');

  // NTLM-Weg über HTTPS: `httpntlm` (v1.8.13) erstellt seinen HTTPS-Agent ohne die Option
  // `rejectUnauthorized` — der TLS-INSECURE-Schalter würde sonst wirkungslos verpuffen und der
  // Zugriff über die IP (Zertifikatsname passt nicht) beim TLS-Aufbau scheitern. Wir geben der
  // Bibliothek deshalb einen eigenen Agent mit; keepAlive ist Pflicht, weil NTLM Aushandlung und
  // Anmeldung über dieselbe Verbindung führt. Nur Dev (tlsInsecure ist in Produktion Fail-Fast).
  const ntlmAgent =
    cfg.auth === 'ntlm' && cfg.tlsInsecure && base.startsWith('https:')
      ? new Agent({ keepAlive: true, rejectUnauthorized: false })
      : undefined;

  const headers: Record<string, string> = {
    Accept: 'application/json; charset=utf-8',
  };
  if (cfg.auth === 'basic') {
    const token = Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  /** Transport 1: fetch (Basic/none) — der Produktionsweg. */
  async function requestFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${base}/${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`DATEV ${init?.method ?? 'GET'} ${path} -> HTTP ${res.status} ${body.slice(0, 300)}`);
    }
    // 201/204 koennen leer sein
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** Transport 2: NTLM (Windows-Domänenkonto) — der verifizierte Weg der Entwicklungsumgebung. */
  async function requestNtlm<T>(path: string, init?: { method?: string; body?: string }): Promise<T> {
    // Lazy require: httpntlm wird nur im NTLM-Modus geladen.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const httpntlm = (await import('httpntlm')) as typeof import('httpntlm');
    const { domain, username } = splitDomainUser(cfg.user);
    const method = (init?.method ?? 'GET').toLowerCase() as 'get' | 'post' | 'put';
    const fn = httpntlm[method];
    return new Promise<T>((resolve, reject) => {
      fn(
        {
          url: `${base}/${path}`,
          username,
          password: cfg.password,
          domain,
          workstation: '',
          headers: {
            ...headers,
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(init?.body ? { body: init.body } : {}),
          // Eigener Agent statt der (wirkungslosen) rejectUnauthorized-Option — s. o.
          ...(ntlmAgent ? { agent: ntlmAgent } : {}),
        },
        (err, res) => {
          if (err) return reject(new Error(`DATEV ${method.toUpperCase()} ${path} -> ${err.message}`));
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(`DATEV ${method.toUpperCase()} ${path} -> HTTP ${res.statusCode} ${(res.body ?? '').slice(0, 300)}`),
            );
          }
          resolve((res.body ? JSON.parse(res.body) : undefined) as T);
        },
      );
    });
  }

  async function request<T>(path: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<T> {
    return cfg.auth === 'ntlm'
      ? requestNtlm<T>(path, init)
      : requestFetch<T>(path, init as RequestInit);
  }

  return {
    async health() {
      try {
        await request('diagnostics/v1/echo');
        return true;
      } catch (err) {
        // Den echten Grund sichtbar machen (sonst zeigt der Start nur "kein OK").
        // eslint-disable-next-line no-console
        console.log(`[DATEV] health-Detail: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },

    async getOrders() {
      const q = cfg.ordersFilter ? `?filter=${encodeURIComponent(cfg.ordersFilter)}` : '';
      const raw = await request<Record<string, unknown>[]>(`order-management/v1/orders${q}`);
      return (raw ?? []).map(mapDatevOrder);
    },

    async getOrder(id) {
      const raw = await request<Record<string, unknown>>(`order-management/v1/orders/${encodeURIComponent(id)}`);
      return raw ? mapDatevOrder(raw) : undefined;
    },

    async postExpensePosting(p: ExpensePosting) {
      // Der EINZIGE POST der API — immer am Teilauftrag. `id` NICHT senden (sonst key mismatch).
      const body = {
        employee_id: p.employeeId,
        work_date: p.workDate,
        cost_position: p.costPosition,
        time_units: p.timeUnits,
        ...(p.comment ? { comment: p.comment } : {}),
      };
      const created = await request<{ id?: string | number }>(
        `order-management/v1/orders/${encodeURIComponent(p.orderId)}/suborders/${encodeURIComponent(p.suborderId)}/expensepostings`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      return { id: String(created?.id ?? '') };
    },
  };
}
