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
  };
}

export function createHttpDatevAdapter(cfg: DatevConfig): DatevPort {
  const base = cfg.baseUrl.replace(/\/$/, '');

  const headers: Record<string, string> = {
    Accept: 'application/json; charset=utf-8',
  };
  if (cfg.auth === 'basic') {
    const token = Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

  return {
    async health() {
      try {
        await request('diagnostics/v1/echo');
        return true;
      } catch {
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
