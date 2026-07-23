import type { ReactNode } from 'react';
import { Check, Square, Trash2, CornerUpRight, X } from 'lucide-react';
import type { Task } from '@/lib/types';
import { useStore, useCurrentUser } from '@/state/store';
import { heute } from '@/lib/heute';
import { addDaysISO, fristInfo } from './taskUtils';

/**
 * Eine Aufgaben-Zeile — genutzt im Modul „Aufgaben" (mit Drag-Griff) UND im Auftrags-Detail
 * (ohne). Bedienelemente greifen nur, wenn der angemeldete Nutzer die Aufgabe erstellt hat ODER
 * ihr Bearbeiter ist (Kollegen geben sich gegenseitig Aufgaben, aber Fremde ändern sie nicht).
 */
export function TaskRow({ task, handle, hideOrderLink }: { task: Task; handle?: ReactNode; hideOrderLink?: boolean }) {
  const me = useCurrentUser();
  const users = useStore((s) => s.users);
  const orders = useStore((s) => s.orders);
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const updateTask = useStore((s) => s.updateTask);
  const assignTask = useStore((s) => s.assignTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const openCard = useStore((s) => s.openCard);

  const darf = !!me && (me.id === task.erstelltVonId || me.id === task.zugewiesenAnId);
  const erledigt = task.status === 'erledigt';
  const frist = fristInfo(task.faelligkeit);
  const order = task.orderId ? orders.find((o) => o.id === task.orderId) : undefined;
  const fremdVergeben = task.erstelltVonId !== task.zugewiesenAnId;

  // „Verschieben": Frist relativ zur aktuellen Fälligkeit (bzw. heute) nach hinten schieben.
  const basis = task.faelligkeit ?? heute();

  return (
    <div className={`task${erledigt ? ' task--done' : ''} task--${frist.tone}`}>
      {handle}
      <button
        className="task__check"
        onClick={() => darf && setTaskStatus(task.id, erledigt ? 'offen' : 'erledigt')}
        disabled={!darf}
        aria-label={erledigt ? 'Wieder öffnen' : 'Als erledigt markieren'}
        title={erledigt ? 'Wieder öffnen' : 'Als erledigt markieren'}
      >
        {erledigt ? <Check size={16} /> : <Square size={16} />}
      </button>

      <div className="task__main">
        <input
          className="task__title"
          value={task.titel}
          readOnly={!darf}
          onChange={(e) => updateTask(task.id, { titel: e.target.value })}
          placeholder="Aufgabe …"
        />
        {task.beschreibung && <div className="task__desc">{task.beschreibung}</div>}

        <div className="task__meta">
          {/* Bearbeiter (zuweisen) */}
          <label className="task__assignee" title="Bearbeiter">
            <CornerUpRight size={13} />
            <select
              value={task.zugewiesenAnId}
              disabled={!darf}
              onChange={(e) => {
                const u = users.find((x) => x.id === e.target.value);
                if (u) assignTask(task.id, u.id, u.name);
              }}
            >
              {users.filter((u) => u.aktiv || u.id === task.zugewiesenAnId).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>

          {/* Frist + Verschieben */}
          <span className={`task__frist task__frist--${frist.tone}`}>{frist.label}</span>
          {darf && !erledigt && (
            <span className="task__frist-edit">
              <input
                type="date"
                value={task.faelligkeit ?? ''}
                onChange={(e) => updateTask(task.id, { faelligkeit: e.target.value })}
                aria-label="Fälligkeitsdatum"
              />
              <button className="btn btn--ghost btn--xs" onClick={() => updateTask(task.id, { faelligkeit: addDaysISO(basis, 1) })} title="Um einen Tag verschieben">+1 Tag</button>
              <button className="btn btn--ghost btn--xs" onClick={() => updateTask(task.id, { faelligkeit: addDaysISO(basis, 7) })} title="Um eine Woche verschieben">+1 Woche</button>
              {task.faelligkeit && (
                <button className="icon-btn icon-btn--sm" onClick={() => updateTask(task.id, { faelligkeit: '' })} aria-label="Frist entfernen"><X size={13} /></button>
              )}
            </span>
          )}

          {/* Verknüpfter Auftrag */}
          {!hideOrderLink && task.orderId && (
            order
              ? <button className="task__order" onClick={() => openCard(order.id)} title="Auftrag öffnen">Auftrag: {order.mandant} · {order.auftragsNr}</button>
              : <span className="task__order task__order--muted">verknüpfter Auftrag</span>
          )}

          {/* Herkunft: wer hat's mir gegeben / wem habe ich's gegeben */}
          {fremdVergeben && (
            <span className="task__from">
              {me && me.id === task.zugewiesenAnId ? `von ${task.erstelltVon}` : `→ ${task.zugewiesenAn}`}
            </span>
          )}
        </div>
      </div>

      {darf && (
        <button className="icon-btn task__del" onClick={() => deleteTask(task.id)} aria-label="Aufgabe löschen" title="Löschen">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
