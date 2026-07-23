import type { Order } from '@/lib/types';
import { useStore } from '@/state/store';
import { aufgabenZuAuftrag, sortiereAufgaben } from '@/state/selectors';
import { TaskRow } from './TaskRow';
import { TaskCompose } from './TaskCompose';

/**
 * To-Do-Bereich im Auftrags-Detail — dieselbe Aufgaben-Sorte wie im Modul „Aufgaben", hier
 * gefiltert auf genau diesen Auftrag (Entscheidung 23.07.2026: neben den Review-Notes). Neu
 * angelegte Aufgaben sind automatisch mit dem Auftrag verknüpft (presetOrderId).
 */
export function OrderTasksSection({ order }: { order: Order }) {
  const tasks = useStore((s) => s.tasks);
  const eigene = aufgabenZuAuftrag(tasks, order.id);
  const offen = sortiereAufgaben(eigene.filter((t) => t.status === 'offen'), 'frist');
  const erledigt = eigene.filter((t) => t.status === 'erledigt');

  return (
    <section className="notes-section">
      <div className="notes-section__head">
        <h3>Aufgaben zu diesem Auftrag</h3>
        <span className="muted">{offen.length} offen{erledigt.length ? ` · ${erledigt.length} erledigt` : ''}</span>
      </div>

      <div className="aufgaben__list" style={{ marginBottom: 12 }}>
        {offen.map((t) => <TaskRow key={t.id} task={t} hideOrderLink />)}
        {erledigt.map((t) => <TaskRow key={t.id} task={t} hideOrderLink />)}
        {eigene.length === 0 && <div className="muted">Noch keine Aufgaben zu diesem Auftrag.</div>}
      </div>

      <TaskCompose presetOrderId={order.id} />
    </section>
  );
}
