import { useState } from 'react';
import { GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@/lib/types';
import { useStore, useCurrentUser } from '@/state/store';
import { aufgabenFuer, vonMirVergeben, sortiereAufgaben } from '@/state/selectors';
import { TaskRow } from './TaskRow';
import { TaskCompose } from './TaskCompose';

/** Eine ziehbare Aufgaben-Zeile (nur im Modul, nur bei manueller Sortierung). */
function SortableTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskRow
        task={task}
        handle={
          <button className="task__drag" {...listeners} aria-label="Verschieben" title="Ziehen zum Umsortieren">
            <GripVertical size={16} />
          </button>
        }
      />
    </div>
  );
}

export function AufgabenView() {
  const me = useCurrentUser();
  const tasks = useStore((s) => s.tasks);
  const reorderTasks = useStore((s) => s.reorderTasks);

  const [tab, setTab] = useState<'mir' | 'vergeben'>('mir');
  const [sortMode, setSortMode] = useState<'manuell' | 'frist'>('manuell');
  const [showErledigt, setShowErledigt] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (!me) return null;

  const basis = tab === 'mir' ? aufgabenFuer(tasks, me.id) : vonMirVergeben(tasks, me.id);
  const offen = sortiereAufgaben(basis.filter((t) => t.status === 'offen'), sortMode);
  const erledigt = basis
    .filter((t) => t.status === 'erledigt')
    .sort((a, b) => (b.erledigtAm ?? '').localeCompare(a.erledigtAm ?? ''));

  const mirOffen = tasks.filter((t) => t.zugewiesenAnId === me.id && t.status === 'offen').length;
  const vergebenOffen = tasks.filter((t) => t.erstelltVonId === me.id && t.zugewiesenAnId !== me.id && t.status === 'offen').length;
  const dragEnabled = sortMode === 'manuell';

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = offen.map((t) => t.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderTasks(arrayMove(ids, from, to));
  }

  return (
    <div className="placeholder">
      <div className="eyebrow" style={{ color: 'var(--bk-blue)' }}>Organisation</div>
      <h1 style={{ fontSize: 'var(--bk-fs-h1)', marginBottom: 4 }}>Aufgaben</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Eigene To-Dos und Aufgaben von Kollegen — optional mit einem Auftrag verknüpft. Fällig­keit ändern
        oder per Ziehen umsortieren.
      </p>

      <div className="aufgaben">
        <TaskCompose />

        <div className="aufgaben__bar">
          <div className="aufgaben__tabs">
            <button className={`nav-pill${tab === 'mir' ? ' is-active' : ''}`} onClick={() => setTab('mir')}>
              Mir zugewiesen{mirOffen > 0 ? ` (${mirOffen})` : ''}
            </button>
            <button className={`nav-pill${tab === 'vergeben' ? ' is-active' : ''}`} onClick={() => setTab('vergeben')}>
              Von mir vergeben{vergebenOffen > 0 ? ` (${vergebenOffen})` : ''}
            </button>
          </div>
          <div className="aufgaben__sort">
            <span className="section-label">Sortierung</span>
            <button className={`type-pill${sortMode === 'manuell' ? '' : ' is-disabled'}`} onClick={() => setSortMode('manuell')}>Manuell</button>
            <button className={`type-pill${sortMode === 'frist' ? '' : ' is-disabled'}`} onClick={() => setSortMode('frist')}>Nach Frist</button>
          </div>
        </div>

        {offen.length === 0 && <div className="muted" style={{ padding: '10px 0' }}>Keine offenen Aufgaben.</div>}

        {dragEnabled ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={offen.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="aufgaben__list">
                {offen.map((t) => <SortableTask key={t.id} task={t} />)}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="aufgaben__list">
            {offen.map((t) => <TaskRow key={t.id} task={t} />)}
          </div>
        )}

        {erledigt.length > 0 && (
          <div className="aufgaben__erledigt">
            <button className="aufgaben__erledigt-head" onClick={() => setShowErledigt((v) => !v)}>
              {showErledigt ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              Erledigt ({erledigt.length})
            </button>
            {showErledigt && (
              <div className="aufgaben__list">
                {erledigt.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
