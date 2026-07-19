import { useState } from 'react';
import { X } from 'lucide-react';
import { useStore, type UserDraft } from '@/state/store';
import type { User, Role } from '@/lib/types';

const EMPTY: UserDraft = {
  name: '', initials: '', email: '', role: 'mitarbeiter', admin: false, datevId: '', tagessoll: 8, arbeitstageProWoche: 5,
};

/** Anlegen-/Bearbeiten-Dialog für einen Nutzer. */
export function UserModal() {
  const editId = useStore((s) => s.userEditId);
  const users = useStore((s) => s.users);

  if (!editId) return null;
  const existing = editId === 'new' ? undefined : users.find((u) => u.id === editId);
  // key sorgt für frischen Formular-State bei jedem Öffnen
  return <UserForm key={editId} existing={existing} />;
}

function UserForm({ existing }: { existing?: User }) {
  const close = useStore((s) => s.closeUserEdit);
  const add = useStore((s) => s.addUser);
  const edit = useStore((s) => s.editUser);

  const [d, setD] = useState<UserDraft>(
    existing
      ? { name: existing.name, initials: existing.initials, email: existing.email, role: existing.role, admin: existing.admin, datevId: existing.datevId, tagessoll: existing.tagessoll, arbeitstageProWoche: existing.arbeitstageProWoche, kvLimitMin: existing.kvLimitMin }
      : EMPTY,
  );

  const nameOk = d.name.trim().length > 0;
  const emailOk = /.+@.+\..+/.test(d.email.trim());
  const valid = nameOk && emailOk && d.initials.trim().length > 0;

  function save() {
    if (!valid) return;
    const draft: UserDraft = { ...d, name: d.name.trim(), initials: d.initials.trim().toUpperCase(), email: d.email.trim(), datevId: d.datevId.trim() };
    if (existing) edit(existing.id, draft);
    else add(draft);
  }

  return (
    <div className="overlay" style={{ zIndex: 70 }} onClick={close}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <button className="modal__close" onClick={close} aria-label="Schließen"><X size={18} /></button>
          <div className="modal__title">
            <h2>{existing ? 'Nutzer bearbeiten' : 'Nutzer anlegen'}</h2>
          </div>
          <div className="modal__sub">Login, Rolle und DATEV-Zuordnung</div>
        </div>

        <div className="modal__body">
          <div className="grid-2">
            <div className="field">
              <label>Name</label>
              <input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="z. B. S. Wolf" />
            </div>
            <div className="field">
              <label>Kürzel</label>
              <input className="input" value={d.initials} maxLength={4} onChange={(e) => setD({ ...d, initials: e.target.value })} placeholder="z. B. SW" />
            </div>
          </div>

          <div className="field">
            <label>E-Mail (Login + Reminder)</label>
            <input className="input" type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} placeholder="name@burchardt-kollegen.de" />
          </div>

          <div className="grid-2">
            <div className="field">
              <label>Rolle</label>
              <select className="input" value={d.role} onChange={(e) => setD({ ...d, role: e.target.value as Role })}>
                <option value="mitarbeiter">Mitarbeiter</option>
                <option value="partner">Partner</option>
                <option value="backoffice">Backoffice (bucht für alle)</option>
              </select>
            </div>
            <div className="field">
              <label>DATEV-Mitarbeiter-ID</label>
              <input className="input" value={d.datevId} onChange={(e) => setD({ ...d, datevId: e.target.value })} placeholder="z. B. 1012" />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label>Tagessoll (Stunden/Tag)</label>
              <input
                className="input" type="number" min={0} max={24} step={0.5}
                value={d.tagessoll}
                onChange={(e) => setD({ ...d, tagessoll: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Arbeitstage / Woche</label>
              <input
                className="input" type="number" min={1} max={5} step={0.5}
                value={d.arbeitstageProWoche}
                onChange={(e) => setD({ ...d, arbeitstageProWoche: Number(e.target.value) })}
              />
              <div className="hint">
                Wochenstunden: {Math.round(d.tagessoll * d.arbeitstageProWoche * 10) / 10} h
                {d.arbeitstageProWoche < 5 ? ' · Teilzeit' : ''}
              </div>
            </div>
          </div>

          <div className="field">
            <label>Kanzleiverwaltung-Limit (Minuten/Tag)</label>
            <input
              className="input" type="number" min={0} step={5}
              value={d.kvLimitMin ?? ''}
              placeholder="leer = unbegrenzt"
              onChange={(e) => setD({ ...d, kvLimitMin: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
            />
            <div className="hint">
              Höchstzeit für „Kanzleiverwaltung" pro Tag. Wird sie überschritten, wird die Buchung
              nicht abgelehnt — der Mitarbeiter bekommt einen Hinweis, dass mehr eine besondere
              Begründung und Genehmigung braucht. Leer = keine Begrenzung.
            </div>
          </div>

          <div className="field">
            <label>Admin-Recht</label>
            <label className="check-line">
              <input type="checkbox" checked={d.admin} onChange={(e) => setD({ ...d, admin: e.target.checked })} />
              <span>Nutzerverwaltung &amp; Konfiguration</span>
            </label>
            <div className="hint">
              Admin ist ein Zusatz-Recht und mit jeder Rolle kombinierbar (z. B. „Partner + Admin").
            </div>
          </div>

          <div className="add-row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn btn--ghost btn--sm" onClick={close}>Abbrechen</button>
            <button className="btn btn--deep btn--sm" disabled={!valid} onClick={save}>
              {existing ? 'Speichern' : 'Anlegen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
