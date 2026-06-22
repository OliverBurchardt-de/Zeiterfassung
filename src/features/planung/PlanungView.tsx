import { useMemo, useState } from 'react';
import type { Order, User } from '@/lib/types';
import { useStore } from '@/state/store';
import { ART, formatHours, isLaufendeArt } from '@/lib/art';
import { arbeitstage, uniqueMonate } from '@/lib/monate';

/**
 * Modul „Planung" — Auslastung je Mitarbeiter und Monat. Mitarbeiter sehen, wie voll ihr Monat
 * ist (geplante Soll-Stunden vs. Kapazität aus Tagessoll × Arbeitstage) und können Aufträge
 * einem Kollegen zuordnen. Monatswechsel selbst laufen über die Umplanung (Partner-Freigabe).
 */
export function PlanungView() {
  const orders = useStore((s) => s.orders);
  const users = useStore((s) => s.users);

  const monate = useMemo(
    () => uniqueMonate(orders.filter((o) => !isLaufendeArt(o.artKey)).map((o) => o.monat)),
    [orders],
  );
  // Standardmonat = der mit den meisten Aufträgen
  const defaultMonat = useMemo(() => {
    const count = new Map<string, number>();
    for (const o of orders) if (!isLaufendeArt(o.artKey)) count.set(o.monat, (count.get(o.monat) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? monate[0];
  }, [orders, monate]);

  const [monat, setMonat] = useState(defaultMonat);
  const tage = arbeitstage(monat);

  // Aktive Mitarbeiter (Träger der Kapazitätsplanung)
  const team = users.filter((u) => u.aktiv && u.role === 'mitarbeiter');

  return (
    <div className="placeholder">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Planung</div>
      <div className="verw-head">
        <div>
          <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Auslastung &amp; Planung</h1>
          <p className="muted" style={{ margin: 0 }}>
            Geplante Stunden gegen die Monatskapazität. Kapazität = Tagessoll × {tage} Arbeitstage
            im {monat}.
          </p>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>Monat</label>
          <select className="input" value={monat} onChange={(e) => setMonat(e.target.value)}>
            {monate.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="plan-grid">
        {team.map((u) => (
          <PlanCard key={u.id} user={u} monat={monat} tage={tage} team={team} orders={orders} />
        ))}
        {team.length === 0 && <div className="panel"><p className="muted">Keine aktiven Mitarbeiter.</p></div>}
      </div>
    </div>
  );
}

function PlanCard({ user, monat, tage, team, orders }: {
  user: User; monat: string; tage: number; team: User[]; orders: Order[];
}) {
  const assign = useStore((s) => s.assignOrder);

  const meine = orders.filter(
    (o) => o.bearbeiter === user.name && o.monat === monat && !isLaufendeArt(o.artKey),
  );
  const geplant = meine.reduce((sum, o) => sum + o.soll, 0);
  const kapazitaet = user.tagessoll * tage;
  const pct = kapazitaet > 0 ? Math.round((geplant / kapazitaet) * 100) : 0;

  const stufe = pct > 100 ? 'over' : pct >= 90 ? 'warn' : 'ok';

  return (
    <div className="panel plan-card">
      <div className="plan-card__head">
        <span className="avatar avatar--34">{user.initials}</span>
        <div>
          <div className="plan-card__name">{user.name}</div>
          <div className="muted" style={{ fontSize: 12 }}>{user.tagessoll} h/Tag · {kapazitaet} h Kapazität</div>
        </div>
        <span className={`plan-pct plan-pct--${stufe}`}>{pct} %</span>
      </div>

      <div className="plan-bar">
        <div className={`plan-bar__fill plan-bar__fill--${stufe}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="muted plan-card__sum">
        {formatHours(geplant)} geplant / {kapazitaet} h
        {pct > 100 && <span className="plan-over"> · {formatHours(geplant - kapazitaet)} über Kapazität</span>}
      </div>

      <div className="plan-orders">
        {meine.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Keine Aufträge in diesem Monat.</div>}
        {meine.map((o) => {
          const art = ART[o.artKey];
          return (
            <div className="plan-order" key={o.id}>
              <span className="art-badge" style={{ background: art.color }}>{art.label}</span>
              <span className="plan-order__mandant">{o.mandant}</span>
              <span className="muted tabular plan-order__h">{o.soll} h</span>
              <select
                className="input plan-order__sel"
                value={user.initials.toLowerCase()}
                onChange={(e) => {
                  const ziel = team.find((t) => t.initials.toLowerCase() === e.target.value);
                  if (ziel && ziel.id !== user.id) assign(o.id, ziel.initials.toLowerCase(), ziel.name);
                }}
                aria-label="Bearbeiter zuordnen"
              >
                {team.map((t) => (
                  <option key={t.id} value={t.initials.toLowerCase()}>{t.initials}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
