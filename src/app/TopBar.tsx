import { Search, LogOut } from 'lucide-react';
import { roleLabel } from '@/lib/tokens';
import type { ModuleKey } from '@/App';
import { useStore, useCurrentUser } from '@/state/store';
import { API_MODE } from '@/api/mode';
import { apiLogout } from '@/api/session';

const logo = '/assets/logo.svg';

const MODULES: { key: ModuleKey; label: string; adminOnly?: boolean }[] = [
  { key: 'board', label: 'Board' },
  { key: 'zeiterfassung', label: 'Zeiterfassung' },
  { key: 'planung', label: 'Planung' },
  { key: 'laufende', label: 'Buchungen' },
  { key: 'controlling', label: 'Controlling' },
  { key: 'zeiten', label: 'Meine Zeiten' },
  { key: 'freigaben', label: 'Freigaben' },
  { key: 'verwaltung', label: 'Verwaltung', adminOnly: true },
];

export function TopBar({ module, onModule }: { module: ModuleKey; onModule: (m: ModuleKey) => void }) {
  const isAdmin = useStore((s) => s.isAdmin);
  const suche = useStore((s) => s.filters.suche);
  const setSuche = useStore((s) => s.setSuche);
  const mockLogout = useStore((s) => s.logout);
  const me = useCurrentUser();
  // Server-Modus: Session auch serverseitig beenden (Cookie ungültig machen).
  const logout = API_MODE ? () => void apiLogout() : mockLogout;

  const rolle = me ? roleLabel(me.role) : 'Mitarbeiter';

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

      <div className="user-chip">
        <span className="avatar avatar--34">{me?.initials}</span>
        <div>
          <div className="user-chip__name">{me?.name}</div>
          <div className="user-chip__role">{rolle}{me?.admin ? ' · Admin' : ''}</div>
        </div>
      </div>
      <button className="btn btn--ghost btn--sm" onClick={logout} title="Abmelden">
        <LogOut size={15} /> Abmelden
      </button>
    </header>
  );
}
