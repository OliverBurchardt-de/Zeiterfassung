import { Check } from 'lucide-react';
import { useStore } from '@/state/store';
import { useVisibleOrders } from '@/state/selectors';
import { EMPLOYEES } from '@/mock/orders';
import { ART } from '@/lib/art';
import { ORDERTYPES, artKeyForOrdertype, istPlanbar } from '@/lib/ordertypes';
import type { ArtKey, Employee, Order } from '@/lib/types';
import { API_MODE } from '@/api/mode';
import { initialenAus } from '@/api/mapping';

/**
 * Server-Modus: Die Mitarbeiter-Liste aus den sichtbaren Aufträgen ableiten (Bearbeiter-IDs
 * kommen vom Server), statt aus der Mock-Liste — bis die Nutzer-API sie liefert (Etappe 3).
 */
function employeesFrom(orders: Order[]): Employee[] {
  const seen = new Map<string, Employee>();
  for (const o of orders) {
    if (o.bearbeiterId && o.bearbeiter && !seen.has(o.bearbeiterId)) {
      seen.set(o.bearbeiterId, { id: o.bearbeiterId, name: o.bearbeiter, initials: initialenAus(o.bearbeiter) });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

// Board-Filter = nur Buckets, in denen PLANBARE Auftragsarten liegen (Entscheidung 15.07.2026) —
// sonst böte die Leiste Filter an, die im Board nie Treffer haben können.
const ART_FILTER: ArtKey[] = Array.from(
  new Set(
    ORDERTYPES.filter((t) => istPlanbar(t.ordertype))
      .map((t) => artKeyForOrdertype(t.ordertype, t.groupId))
      .filter((a): a is ArtKey => a !== null),
  ),
);
const ART_LABEL: Record<ArtKey, string> = {
  fibu: 'Finanzbuchhaltung', lohn: 'Lohnbuchführung', ja: 'Jahresabschluss', est: 'Private Steuern',
  beratung: 'Steuerliche Beratung', wirtschaft: 'Wirtschaftliche Beratung', hausverwaltung: 'Hausverwaltung',
  vorbehalt: 'Vorbehaltsaufgaben', lfd_beratung: 'Laufende Steuerberatung', mehraufwand: 'Mehraufwand',
};

export function FilterSidebar() {
  // Dieselbe Basis wie das Board: sichtbare, PLANBARE Aufträge — sonst zeigen die
  // Zähler Zahlen, die dem Board widersprechen.
  const visible = useVisibleOrders();
  const orders = visible.filter((o) => istPlanbar(o.ordertype));
  const filters = useStore((s) => s.filters);
  const setEmployee = useStore((s) => s.setEmployee);
  const setMonat = useStore((s) => s.setMonat);
  const setVj = useStore((s) => s.setVj);
  const toggleArt = useStore((s) => s.toggleArt);
  const toggleQuick = useStore((s) => s.toggleQuick);

  const monate = ['alle', ...Array.from(new Set(orders.map((o) => o.monat).filter(Boolean)))];
  const jahre = Array.from(new Set(orders.map((o) => o.vj))).sort((a, b) => b - a);
  const countFor = (id: string) => orders.filter((o) => o.bearbeiterId === id).length;

  return (
    <aside className="col-left">
      <div className="panel">
        <h4 style={{ marginBottom: 14 }}>Arbeitsvorrat</h4>

        <div className="filter-group">
          <div className="section-label">Mitarbeiter</div>
          {(API_MODE ? employeesFrom(orders) : EMPLOYEES).map((e) => (
            <button
              key={e.id}
              className={`emp-row${filters.employeeId === e.id ? ' is-active' : ''}`}
              onClick={() => setEmployee(e.id)}
            >
              <span className="avatar avatar--24">{e.initials}</span>
              <span className="emp-row__name">{e.name}</span>
              <span className="emp-row__count">{countFor(e.id)}</span>
            </button>
          ))}
          <button
            className={`emp-row${filters.employeeId === 'team' ? ' is-active' : ''}`}
            onClick={() => setEmployee('team')}
          >
            <span className="avatar avatar--24">T</span>
            <span className="emp-row__name">Mein Team</span>
            <span className="emp-row__count">{orders.length}</span>
          </button>
        </div>

        <div className="filter-group">
          <div className="section-label">Geplanter Monat</div>
          <select className="select-pill" value={filters.monat} onChange={(e) => setMonat(e.target.value)}>
            {monate.map((m) => (
              <option key={m} value={m}>{m === 'alle' ? 'Alle Monate' : m}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="section-label">Veranlagungsjahr</div>
          <select
            className="select-pill"
            value={filters.vj}
            onChange={(e) => setVj(e.target.value === 'alle' ? 'alle' : Number(e.target.value))}
          >
            <option value="alle">Alle Jahre</option>
            {jahre.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="section-label">Auftragsart</div>
          {ART_FILTER.map((a) => {
            const on = filters.arten.includes(a);
            return (
              <label key={a} className="check-row">
                <span className={`checkbox${on ? ' is-on' : ''}`}>{on && <Check size={13} strokeWidth={3} />}</span>
                <input type="checkbox" checked={on} onChange={() => toggleArt(a)} hidden />
                <span style={{ color: ART[a].color, fontWeight: 600, fontSize: 11 }}>{ART[a].label}</span>
                {ART_LABEL[a]}
              </label>
            );
          })}
        </div>

        <div className="filter-group">
          <div className="section-label">Schnellfilter</div>
          <label className="check-row">
            <span className={`checkbox${filters.nurOffeneZeiten ? ' is-on' : ''}`}>
              {filters.nurOffeneZeiten && <Check size={13} strokeWidth={3} />}
            </span>
            <input type="checkbox" checked={filters.nurOffeneZeiten} onChange={() => toggleQuick('nurOffeneZeiten')} hidden />
            Nur offene Zeiten
          </label>
          <label className="check-row">
            <span className={`checkbox${filters.freigabeAusstehend ? ' is-on' : ''}`}>
              {filters.freigabeAusstehend && <Check size={13} strokeWidth={3} />}
            </span>
            <input type="checkbox" checked={filters.freigabeAusstehend} onChange={() => toggleQuick('freigabeAusstehend')} hidden />
            Freigabe ausstehend
          </label>
        </div>
      </div>
    </aside>
  );
}
