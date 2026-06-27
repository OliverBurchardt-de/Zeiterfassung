import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useStore } from '@/state/store';

const logo = '/assets/logo.jpg';

/**
 * Mock-Login. Meldet den Nutzer an, wodurch Rolle/Admin-Recht und die Sichtbarkeit der Aufträge
 * gesetzt werden. HINWEIS: reine Frontend-Demo — keine echte Sicherheit. Verbindliche
 * Authentifizierung/Autorisierung kommt serverseitig in M2 (eigener Login).
 */
export function LoginView() {
  const users = useStore((s) => s.users);
  const login = useStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const aktive = users.filter((u) => u.aktiv);

  function submit() {
    const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) { setError('Unbekannte E-Mail-Adresse.'); return; }
    if (!u.aktiv) { setError('Dieses Konto ist deaktiviert.'); return; }
    if (!pass.trim()) { setError('Bitte ein Passwort eingeben.'); return; }
    login(u.id);
  }

  return (
    <div className="login">
      <div className="login__card">
        <img className="login__logo" src={logo} alt="Burchardt & Kollegen" />
        <h1 className="login__title">Anmelden</h1>
        <p className="muted login__sub">Zeiterfassung & Auftragsabwicklung</p>

        <div className="field">
          <label>E-Mail</label>
          <input
            className="input" type="email" value={email} autoFocus
            placeholder="name@burchardt-kollegen.de"
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
        </div>
        <div className="field">
          <label>Passwort</label>
          <input
            className="input" type="password" value={pass}
            placeholder="••••••••"
            onChange={(e) => { setPass(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
        </div>
        {error && <div className="hint" style={{ color: 'var(--bk-blood-orange)' }}>{error}</div>}

        <button className="btn btn--deep" style={{ width: '100%', marginTop: 6 }} onClick={submit}>
          <LogIn size={16} /> Anmelden
        </button>

        <div className="login__demo">
          <div className="section-label">Demo-Schnellanmeldung</div>
          <div className="login__users">
            {aktive.map((u) => (
              <button key={u.id} className="login__user" onClick={() => login(u.id)}>
                <span className="avatar avatar--24">{u.initials}</span>
                <span className="login__user-text">
                  <span className="login__user-name">{u.name}</span>
                  <span className="muted">{u.role === 'partner' ? 'Partner' : 'Mitarbeiter'}{u.admin ? ' · Admin' : ''}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="hint">
            Mock-Anmeldung ohne echte Prüfung. Mitarbeiter sehen nur ihre eigenen Aufträge,
            Partner/Admin entsprechend mehr. Verbindlicher Login folgt in M2.
          </div>
        </div>
      </div>
    </div>
  );
}
