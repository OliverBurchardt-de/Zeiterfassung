import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore, useCurrentUser } from '@/state/store';

/**
 * Anlege-Formular für eine Aufgabe. Im Modul „Aufgaben" mit Auftrags-Auswahl (optional),
 * im Auftrags-Detail mit fest vorgegebenem Auftrag (presetOrderId → Auswahl ausgeblendet).
 */
export function TaskCompose({ presetOrderId }: { presetOrderId?: string }) {
  const me = useCurrentUser();
  const users = useStore((s) => s.users);
  const orders = useStore((s) => s.orders);
  const addTask = useStore((s) => s.addTask);

  const [titel, setTitel] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [zugewiesenAnId, setZugewiesenAnId] = useState(me?.id ?? '');
  const [faelligkeit, setFaelligkeit] = useState('');
  const [orderId, setOrderId] = useState(presetOrderId ?? '');
  const [offen, setOffen] = useState(false); // Beschreibung/Details ausklappen

  if (!me) return null;

  function submit() {
    const u = users.find((x) => x.id === zugewiesenAnId) ?? me!;
    addTask(
      { titel, beschreibung, zugewiesenAnId: u.id, zugewiesenAn: u.name, faelligkeit: faelligkeit || undefined, orderId: presetOrderId ?? (orderId || undefined) },
      me!,
    );
    setTitel(''); setBeschreibung(''); setFaelligkeit(''); setOffen(false);
    if (!presetOrderId) setOrderId('');
    setZugewiesenAnId(me!.id);
  }

  return (
    <div className="task-compose">
      <div className="task-compose__row">
        <input
          className="input"
          placeholder="Neue Aufgabe …"
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && titel.trim()) submit(); }}
        />
        <label className="task-compose__field" title="Bearbeiter">
          <span className="section-label">für</span>
          <select value={zugewiesenAnId} onChange={(e) => setZugewiesenAnId(e.target.value)}>
            {users.filter((u) => u.aktiv).map((u) => (
              <option key={u.id} value={u.id}>{u.id === me!.id ? 'mich' : u.name}</option>
            ))}
          </select>
        </label>
        <label className="task-compose__field" title="Fällig am">
          <span className="section-label">fällig</span>
          <input type="date" value={faelligkeit} onChange={(e) => setFaelligkeit(e.target.value)} />
        </label>
        <button className="btn btn--deep" onClick={submit} disabled={!titel.trim()}>
          <Plus size={15} /> Anlegen
        </button>
      </div>

      <div className="task-compose__more">
        <button className="btn btn--ghost btn--xs" onClick={() => setOffen((v) => !v)}>
          {offen ? 'Weniger' : 'Beschreibung / Auftrag …'}
        </button>
      </div>
      {offen && (
        <div className="task-compose__extra">
          <input
            className="input"
            placeholder="Beschreibung (optional)"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
          />
          {!presetOrderId && (
            <label className="task-compose__field" title="Auftrag verknüpfen">
              <span className="section-label">Auftrag</span>
              <select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">— ohne Auftrag —</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.mandant} · {o.auftragsNr} ({o.art})</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
