import { useEffect, useState } from 'react';
import { X, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { useStore } from '@/state/store';
import { ordertypeInfo } from '@/lib/ordertypes';

type Parsed = {
  map: Record<string, string[]>; // bekannte Auftragsart → Punkte
  unknown: string[]; // unbekannte Codes (übersprungen)
  rows: number; // verwertete Zeilen
};

/**
 * Checklisten aus Excel/CSV einspielen. Erwartetes Format: zwei Spalten — Auftragsart (DATEV-Code,
 * z. B. 106, 301, JAP) und Punkt (ein Checklistenpunkt je Zeile). Mehrere Zeilen je Auftragsart.
 * Modus „ersetzen" überschreibt die Vorlage der Auftragsart, „ergänzen" hängt an. Parser (SheetJS)
 * wird erst beim Einlesen dynamisch geladen.
 */
export function ChecklistImportModal({ onClose }: { onClose: () => void }) {
  const templates = useStore((s) => s.checklistTemplates);
  const setTemplate = useStore((s) => s.setChecklistTemplate);

  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mode, setMode] = useState<'ersetzen' | 'ergaenzen'>('ersetzen');
  const [error, setError] = useState('');
  const [done, setDone] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function onFile(file: File) {
    setError(''); setParsed(null); setDone(0); setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, raw: false });

      const map: Record<string, string[]> = {};
      const unknown = new Set<string>();
      let used = 0;
      for (const r of rows) {
        const code = String(r?.[0] ?? '').trim();
        const label = String(r?.[1] ?? '').trim();
        if (!code || !label) continue;
        // Kopfzeile überspringen
        if (/auftrags?art/i.test(code) || /punkt|check|aufgabe/i.test(label)) continue;
        if (!ordertypeInfo(code)) { unknown.add(code); continue; }
        (map[code] ??= []).push(label);
        used++;
      }
      if (used === 0) {
        setError('Keine verwertbaren Zeilen gefunden. Erwartet: Spalte A = Auftragsart-Code, Spalte B = Checklistenpunkt.');
        return;
      }
      setParsed({ map, unknown: [...unknown], rows: used });
    } catch {
      setError('Datei konnte nicht gelesen werden. Bitte eine .xlsx- oder .csv-Datei verwenden.');
    }
  }

  function apply() {
    if (!parsed) return;
    for (const [code, labels] of Object.entries(parsed.map)) {
      const next = mode === 'ersetzen' ? labels : [...(templates[code] ?? []), ...labels];
      setTemplate(code, next);
    }
    setDone(Object.keys(parsed.map).length);
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Auftragsart', 'Punkt'],
      ['106', 'Kassenbuch geprüft'],
      ['106', 'USt-Voranmeldung erstellt'],
      ['301', 'Summen- & Saldenliste geprüft'],
      ['301', 'Inventar abgestimmt'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Checklisten');
    XLSX.writeFile(wb, 'checklisten-vorlage.xlsx');
  }

  return (
    <div className="overlay" style={{ zIndex: 70 }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <button className="modal__close" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
          <div className="modal__title"><h2>Checklisten importieren</h2></div>
          <div className="modal__sub">Excel/CSV — Spalte A: Auftragsart-Code · Spalte B: Checklistenpunkt</div>
        </div>

        <div className="modal__body">
          {done > 0 ? (
            <div className="tmpl">
              <div className="state-line" style={{ color: 'var(--bk-success)', fontWeight: 600 }}>
                <FileSpreadsheet size={16} /> Import abgeschlossen — {done} Auftragsart(en) aktualisiert.
              </div>
              <div className="add-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                <button className="btn btn--deep btn--sm" onClick={onClose}>Schließen</button>
              </div>
            </div>
          ) : (
            <>
              <div className="hint" style={{ marginTop: 0 }}>
                Pro Zeile eine Aufgabe; mehrere Zeilen je Auftragsart sind erlaubt. Unbekannte Codes
                werden übersprungen. <button className="link-btn" onClick={downloadTemplate}>
                  <Download size={13} /> Beispiel-Vorlage herunterladen
                </button>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label>Datei (.xlsx / .csv)</label>
                <input
                  className="input" type="file" accept=".xlsx,.xls,.csv"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                />
                {fileName && <div className="hint">Gewählt: {fileName}</div>}
              </div>

              {error && <div className="hint" style={{ color: 'var(--bk-blood-orange)' }}>{error}</div>}

              {parsed && (
                <>
                  <div className="field">
                    <label>Modus</label>
                    <label className="check-line">
                      <input type="radio" name="mode" checked={mode === 'ersetzen'} onChange={() => setMode('ersetzen')} />
                      <span>Vorlage <b>ersetzen</b> (vorhandene Punkte der Auftragsart überschreiben)</span>
                    </label>
                    <label className="check-line">
                      <input type="radio" name="mode" checked={mode === 'ergaenzen'} onChange={() => setMode('ergaenzen')} />
                      <span>Punkte <b>ergänzen</b> (an die vorhandene Vorlage anhängen)</span>
                    </label>
                  </div>

                  <div className="tmpl">
                    <div className="section-label" style={{ marginBottom: 6 }}>
                      Vorschau · {parsed.rows} Punkte für {Object.keys(parsed.map).length} Auftragsart(en)
                    </div>
                    {Object.entries(parsed.map).map(([code, labels]) => (
                      <div className="tmpl-row" key={code} style={{ alignItems: 'baseline' }}>
                        <span className="tabular" style={{ minWidth: 56 }}>{code}</span>
                        <span className="muted" style={{ flex: 1 }}>{ordertypeInfo(code)?.name} — {labels.length} Punkte</span>
                      </div>
                    ))}
                    {parsed.unknown.length > 0 && (
                      <div className="hint" style={{ color: 'var(--bk-blood-orange)' }}>
                        Übersprungen (unbekannte Auftragsart): {parsed.unknown.join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="add-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                    <button className="btn btn--ghost btn--sm" onClick={onClose}>Abbrechen</button>
                    <button className="btn btn--deep btn--sm" onClick={apply}><Upload size={14} /> Importieren</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
