import { Agent } from 'node:https';
import type { DatevPort, ExpensePosting } from '../domain/ports';
import type { OrderView, SuborderView, DatevClient } from '../domain/types';
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

  // Teilauftraege (via `expand=suborders` mitgeladen): reduziert auf die App-relevanten Felder.
  const suborders: SuborderView[] | undefined = Array.isArray(raw.suborders)
    ? (raw.suborders as Record<string, unknown>[]).map((s) => ({
        id: str(s.id),
        number: num(s.suborder_number) ?? 0,
        name: str(s.suborder_name) ?? '',
        periodFrom: isoDate(s.period_from),
        periodTo: isoDate(s.period_to),
        plannedHours: num(s.planned_hours),
        dateWorkCompleted: isoDate(s.date_work_completed),
      }))
    : undefined;

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
    // clientName/clientNumber loest das Board-Aggregat ueber getClients() auf (Master Data).
    ...(suborders && suborders.length ? { suborders } : {}),
  };
}

/** Client-Master-Data-Zeile -> DatevClient (differing_name hat Vorrang vor name, wie in EO). */
export function mapDatevClient(raw: Record<string, unknown>): DatevClient {
  const name = raw.differing_name ?? raw.name;
  return {
    id: String(raw.id ?? ''),
    name: name === null || name === undefined ? '' : String(name),
    number: raw.number === null || raw.number === undefined ? undefined : String(raw.number),
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

  // Cache fuer die Mandanten-Stammdaten (siehe getClients).
  const CLIENTS_CACHE_MS = 10 * 60 * 1000;
  let clientsCache: DatevClient[] | null = null;
  let clientsCacheTime = 0;
  let clientsInFlight: Promise<DatevClient[]> | null = null;

  // Cache fuer die Auftragsliste: der Abruf mit expand=suborders ist gross (am Echtsystem
  // ~35 s ueber VPN) — ohne Cache wartete JEDER Board-Aufruf so lange. 60 s TTL: kurz genug,
  // dass fremde DATEV-Aenderungen zeitnah erscheinen; eigene Schreibaktionen laufen ohnehin
  // ueber die App-DB (Overlay/Zeiten/Notes) und sind sofort sichtbar. In-Flight-Dedupe, damit
  // parallele Board-Aufrufe (mehrere Nutzer) denselben DATEV-Abruf teilen.
  const ORDERS_CACHE_MS = 60 * 1000;
  let ordersCache: OrderView[] | null = null;
  let ordersCacheTime = 0;
  let ordersInFlight: Promise<OrderView[]> | null = null;

  const headers: Record<string, string> = {
    Accept: 'application/json; charset=utf-8',
  };
  if (cfg.auth === 'basic') {
    const token = Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  /** Transport 1: fetch (Basic/none) — der Produktionsweg. */
  async function requestFetch<T>(path: string, init?: RequestInit): Promise<T> {
    // Hartes Timeout (Review P2-7): ein haengender DATEV-Dienst darf Requests/Warm-up nicht
    // dauerhaft binden. AbortSignal.timeout bricht den Abruf nach cfg.timeoutMs ab.
    const res = await fetch(`${base}/${path}`, {
      ...init,
      signal: AbortSignal.timeout(cfg.timeoutMs),
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
    // Lazy import: httpntlm wird nur im NTLM-Modus geladen. httpntlm ist ein CommonJS-Modul —
    // beim dynamischen Import landen get/post/put unter `.default` (Interop), nicht direkt am
    // Namespace. Ohne dieses Auspacken ist httpntlm[method] undefined ("fn is not a function").
    const imported = (await import('httpntlm')) as typeof import('httpntlm') & {
      default?: typeof import('httpntlm');
    };
    const httpntlm = imported.default ?? imported;
    const { domain, username } = splitDomainUser(cfg.user);
    const method = (init?.method ?? 'GET').toLowerCase() as 'get' | 'post' | 'put';
    const fn = httpntlm[method];
    // httpntlm kennt keine AbortSignal-Option — Timeout via Promise.race (Review P2-7).
    const abbruch = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`DATEV ${method.toUpperCase()} ${path} -> Timeout nach ${cfg.timeoutMs} ms`)), cfg.timeoutMs).unref?.()
    );
    const anfrage = new Promise<T>((resolve, reject) => {
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
    return Promise.race([anfrage, abbruch]);
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
      const now = Date.now();
      if (ordersCache && now - ordersCacheTime < ORDERS_CACHE_MS) return ordersCache;
      if (!ordersInFlight) {
        // expand=suborders: Teilauftraege in EINEM Abruf mitladen (statt 1 Detail-GET je Auftrag)
        // — Basis der Karten-Anzeige „naechster offener Teilauftrag".
        const params = new URLSearchParams({ expand: 'suborders' });
        if (cfg.ordersFilter) params.set('filter', cfg.ordersFilter);
        ordersInFlight = request<Record<string, unknown>[]>(`order-management/v1/orders?${params.toString()}`)
          .then((raw) => {
            ordersCache = (raw ?? []).map(mapDatevOrder);
            ordersCacheTime = Date.now();
            return ordersCache;
          })
          .finally(() => {
            ordersInFlight = null;
          });
      }
      return ordersInFlight;
    },

    async getClients() {
      // Stammdaten aendern sich selten: 10 Minuten cachen, damit nicht jeder Board-Aufruf die
      // komplette Mandantenliste zieht; parallele Aufrufe teilen sich denselben Abruf.
      const now = Date.now();
      if (clientsCache && now - clientsCacheTime < CLIENTS_CACHE_MS) return clientsCache;
      if (!clientsInFlight) {
        clientsInFlight = request<Record<string, unknown>[]>('master-data/v1/clients')
          .then((raw) => {
            clientsCache = (raw ?? []).map(mapDatevClient);
            clientsCacheTime = Date.now();
            return clientsCache;
          })
          .finally(() => {
            clientsInFlight = null;
          });
      }
      return clientsInFlight;
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
