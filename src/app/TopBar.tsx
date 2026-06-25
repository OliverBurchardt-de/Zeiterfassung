import { Search } from 'lucide-react';
import type { ModuleKey } from '@/App';
import { useStore } from '@/state/store';
import { CURRENT_USER } from '@/mock/orders';

const logo = '/assets/logo.jpg';

const MODULES: { key: ModuleKey; label: string; adminOnly?: boolean }[] = [
  { key: 'board', label: 'Board' },
  { key: 'planung', label: 'Planung' },
  { key: 'laufende', label: 'Laufende Buchungen' },
  { key: 'controlling', label: 'Controlling' },
  { key: 'zeiten', label: 'Meine Zeiten' },
  { key: 'freigaben', label: 'Freigaben' },
  { key: 'verwaltung', label: 'Verwaltung', adminOnly: true },
];

export function TopBar({ module, onModule }: { module: ModuleKey; onModule: (m: ModuleKey) => void }) {
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const isAdmin = useStore((s) => s.isAdmin);
  const setAdmin = useStore((s) => s.setAdmin);
  const suche = useStore((s) => s.filters.suche);
  const setSuche = useStore((s) => s.setSuche);

  function toggleAdmin(v: boolean) {
    setAdmin(v);
    if (!v && module === 'verwaltung') onModule('board');
  }

  return (
    <header className="topbar">
      <img className="topbar__logo" src={logo} alt="Burchardt & Kollegen" />
      <div className="topbar__divider" />
      <nav className="topbar__nav">
        {MODULES.filter((m) => !m.adminOnly || isAdmin).map((m) => (
          <button
            key={m.key}
            className={`nav-pill${module === m.key ? ' is-active' : ''}`}
            onClick={() => onModule(m.key)}
          >
            {m.label}
          </button>
        ))}
      </nav>

      <div className="topbar__spacer" />

      <div className="search">
        <Search size={16} />
        <input
          placeholder="Auftrag oder Mandant suchen …"
          aria-label="Suche"
          value={suche}
          onChange={(e) => { setSuche(e.target.value); if (e.target.value.trim()) onModule('board'); }}
        />
      </div>

      <div className="role-switch" role="group" aria-label="Rolle wählen">
        <button className={role === 'mitarbeiter' ? 'is-active' : ''} onClick={() => setRole('mitarbeiter')}>
          Mitarbeiter
        </button>
        <button className={role === 'partner' ? 'is-active' : ''} onClick={() => setRole('partner')}>
          Partner
        </button>
      </div>

      <label className="admin-toggle" title="Demo: Admin-Zusatzrecht">
        <input type="checkbox" checked={isAdmin} onChange={(e) => toggleAdmin(e.target.checked)} />
        <span>Admin</span>
      </label>

      <div className="user-chip">
        <span className="avatar avatar--34">{CURRENT_USER.initials}</span>
        <div>
          <div className="user-chip__name">{CURRENT_USER.name}</div>
          <div className="user-chip__role">{role === 'partner' ? 'Partner' : 'Mitarbeiter'}</div>
        </div>
      </div>
    </header>
  );
}
