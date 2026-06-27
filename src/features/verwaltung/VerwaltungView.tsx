import { useState } from 'react';
import { Plus, Pencil, UserCheck, UserX, ListChecks, Upload } from 'lucide-react';
import { useStore } from '@/state/store';
import { ChecklistTemplatesModal } from './ChecklistTemplatesModal';
import { ChecklistImportModal } from './ChecklistImportModal';

/**
 * Modul „Verwaltung" — Nutzerverwaltung (Mock). Sichtbar nur mit Admin-Zusatzrecht.
 * Anlegen / Bearbeiten / Deaktivieren (kein Löschen — Historie bleibt erhalten).
 * Login/Persistenz folgen in M2 (eigene App-DB).
 */
export function VerwaltungView() {
  const users = useStore((s) => s.users);
  const openEdit = useStore((s) => s.openUserEdit);
  const setActive = useStore((s) => s.setUserActive);
  const [clModal, setClModal] = useState<'manage' | 'import' | null>(null);

  const aktive = users.filter((u) => u.aktiv);
  const inaktive = users.filter((u) => !u.aktiv);

  return (
    <div className="placeholder">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Administration</div>
      <div className="verw-head">
        <div>
          <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Verwaltung</h1>
          <p className="muted" style={{ margin: 0 }}>
            Mitarbeiter anlegen, Rollen und Rechte pflegen, DATEV-Mitarbeiter-ID hinterlegen.
            Deaktivierte Nutzer bleiben in der Historie erhalten.
          </p>
        </div>
        <button className="btn btn--deep" onClick={() => openEdit('new')}>
          <Plus size={16} /> Nutzer anlegen
        </button>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <table className="utable">
          <thead>
            <tr>
              <th>Nutzer</th>
              <th>E-Mail</th>
              <th>Rolle</th>
              <th>Rechte</th>
              <th>DATEV-ID</th>
              <th className="utable__num">Tagessoll</th>
              <th className="utable__num">Tage/Wo.</th>
              <th>Status</th>
              <th className="utable__act">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {[...aktive, ...inaktive].map((u) => (
              <tr key={u.id} className={u.aktiv ? '' : 'utable__row--off'}>
                <td>
                  <div className="utable__user">
                    <span className="avatar avatar--24">{u.initials}</span>
                    <div>
                      <div className="utable__name">{u.name}</div>
                      <div className="muted utable__kuerzel">{u.initials}</div>
                    </div>
                  </div>
                </td>
                <td className="muted">{u.email}</td>
                <td>{u.role === 'partner' ? 'Partner' : 'Mitarbeiter'}</td>
                <td>
                  {u.admin
                    ? <span className="badge badge--admin">Admin</span>
                    : <span className="muted">—</span>}
                </td>
                <td className="tabular">{u.datevId}</td>
                <td className="utable__num tabular">{u.tagessoll} h</td>
                <td className="utable__num tabular">
                  {u.arbeitstageProWoche}{u.arbeitstageProWoche < 5 ? ' · TZ' : ''}
                </td>
                <td>
                  <span className={`badge ${u.aktiv ? 'badge--ok' : 'badge--notok'}`}>
                    {u.aktiv ? 'Aktiv' : 'Deaktiviert'}
                  </span>
                </td>
                <td className="utable__act">
                  <button className="btn btn--ghost btn--sm" onClick={() => openEdit(u.id)}>
                    <Pencil size={13} /> Bearbeiten
                  </button>
                  {u.aktiv ? (
                    <button className="btn btn--ghost btn--sm" onClick={() => setActive(u.id, false)}>
                      <UserX size={13} /> Deaktivieren
                    </button>
                  ) : (
                    <button className="btn btn--ghost btn--sm" onClick={() => setActive(u.id, true)}>
                      <UserCheck size={13} /> Reaktivieren
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hint" style={{ marginTop: 14 }}>
        Mock-Ansicht. Eigener Login, Passwort/Einladung und Persistenz folgen in Meilenstein 2;
        die DATEV-Mitarbeiter-ID verknüpft den Nutzer mit den Auftrags-Verantwortlichkeiten in DATEV EO.
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel__title"><h4>Checklisten-Vorlagen</h4></div>
        <div className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Aufgaben-Checklisten je Auftragsart — voreingestellte Vorlagen nutzen/aktualisieren,
          bearbeiten, neu anlegen oder aus Excel/CSV einspielen.
        </div>
        <div className="add-row" style={{ marginTop: 0 }}>
          <button className="btn btn--deep" onClick={() => setClModal('manage')}>
            <ListChecks size={16} /> Checklisten verwalten
          </button>
          <button className="btn btn--ghost" onClick={() => setClModal('import')}>
            <Upload size={16} /> Aus Excel/CSV importieren
          </button>
        </div>
      </div>

      {clModal === 'manage' && <ChecklistTemplatesModal onClose={() => setClModal(null)} />}
      {clModal === 'import' && <ChecklistImportModal onClose={() => setClModal(null)} />}
    </div>
  );
}
