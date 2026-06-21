import { Search } from 'lucide-react';
import type { ModuleKey } from '@/App';
import { useStore } from '@/state/store';
import { CURRENT_USER } from '@/mock/orders';

const logo = '/assets/logo.jpg';

const MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'board', label: 'Board' },
  { key: 'laufende', label: 'Laufende Buchungen' },
  { key: 'zeiten', label: 'Meine Zeiten' },
  { key: 'freigaben', label: 'Freigaben' },
];

export function TopBar({ module, onModule }: { module: ModuleKey; onModule: (m: ModuleKey) => void }) {
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);

  return (
    <header className="topbar">
      <img className="topbar__logo" src={logo} alt="Burchardt & Kollegen" />
      <div className="topbar__divider" />
      <nav className="topbar__nav">
        {MODULES.map((m) => (
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
        <input placeholder="Auftrag oder Mandant suchen …" aria-label="Suche" />
      </div>

      <div className="role-switch" role="group" aria-label="Rolle wählen">
        <button className={role === 'mitarbeiter' ? 'is-active' : ''} onClick={() => setRole('mitarbeiter')}>
          Mitarbeiter
        </button>
        <button className={role === 'partner' ? 'is-active' : ''} onClick={() => setRole('partner')}>
          Partner
        </button>
      </div>

      <div className="user-chip">
        <span className="avatar avatar--34">{CURRENT_USER.initials}</span>
        <div>
          <div className="user-chip__name">{CURRENT_USER.name}</div>
          <div className="user-chip__role">{role === 'partner' ? 'Partner' : 'Sachbearbeiter'}</div>
        </div>
      </div>
    </header>
  );
}
