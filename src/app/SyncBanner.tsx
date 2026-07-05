import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '@/state/store';

/**
 * Hinweisleiste für fehlgeschlagene Server-Schreibaktionen (nur Server-Modus). Der Store setzt
 * `syncError`, wenn eine optimistisch angezeigte Änderung serverseitig nicht gespeichert werden
 * konnte (danach wurde der echte Serverstand nachgeladen). Der Nutzer bestätigt mit „Schließen".
 */
export function SyncBanner() {
  const syncError = useStore((s) => s.syncError);
  const setSyncError = useStore((s) => s.setSyncError);
  if (!syncError) return null;
  return (
    <div className="sync-banner" role="alert">
      <AlertTriangle size={16} />
      <span>{syncError}</span>
      <button className="icon-btn" aria-label="Schließen" onClick={() => setSyncError(null)}>
        <X size={16} />
      </button>
    </div>
  );
}
