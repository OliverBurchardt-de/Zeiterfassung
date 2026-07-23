import { useEffect, useState } from 'react';
import { TopBar } from '@/app/TopBar';
import { KpiHeader } from '@/app/KpiHeader';
import { FilterSidebar } from '@/features/board/FilterSidebar';
import { Board } from '@/features/board/Board';
import { RightColumn } from '@/features/board/RightColumn';
import { OrderModal } from '@/features/order/OrderModal';
import { LaufendeView } from '@/features/laufende/LaufendeView';
import { PlanungView } from '@/features/planung/PlanungView';
import { ControllingView } from '@/features/controlling/ControllingView';
import { FreigabenView } from '@/features/freigaben/FreigabenView';
import { ZeitenView } from '@/features/zeiten/ZeitenView';
import { ZeiterfassungBoard } from '@/features/zeiterfassung/ZeiterfassungBoard';
import { AufgabenView } from '@/features/aufgaben/AufgabenView';
import { VerwaltungView } from '@/features/verwaltung/VerwaltungView';
import { UserModal } from '@/features/verwaltung/UserModal';
import { LoginView } from '@/features/auth/LoginView';
import { SyncBanner } from '@/app/SyncBanner';
import { useStore } from '@/state/store';
import { API_MODE } from '@/api/mode';
import { apiRestore } from '@/api/session';

export type ModuleKey = 'board' | 'zeiterfassung' | 'planung' | 'laufende' | 'controlling' | 'zeiten' | 'aufgaben' | 'freigaben' | 'verwaltung';

export function App() {
  const [module, setModule] = useState<ModuleKey>('board');
  // Server-Modus: beim Start eine bestehende Session (Cookie) wiederherstellen,
  // bevor der Login-Bildschirm aufblitzt.
  const [restoring, setRestoring] = useState(API_MODE);
  const openCardId = useStore((s) => s.openCardId);
  const currentUserId = useStore((s) => s.currentUserId);
  const isAdmin = useStore((s) => s.isAdmin);

  useEffect(() => {
    if (API_MODE) void apiRestore().finally(() => setRestoring(false));
  }, []);

  // Render-Gate (Review P2-4): die Verwaltung haengt NICHT allein am lokalen Modul-Zustand.
  // Wechselt der angemeldete Nutzer (Ab-/Anmeldung) oder verliert er das Adminrecht, faellt die
  // Ansicht sofort auf das Board zurueck — sonst koennte die Verwaltung nach einem Nutzerwechsel
  // im weiter gemounteten App sichtbar bleiben.
  useEffect(() => {
    if (module === 'verwaltung' && !isAdmin) setModule('board');
  }, [module, isAdmin, currentUserId]);

  if (restoring) {
    return (
      <div className="login">
        {/* Hinter diesem Schritt laeuft auch der erste Auftrags-Abruf — ehrlich benennen. */}
        <div className="login__card"><p className="muted">Anmeldung wird geprüft und Aufträge werden geladen …</p></div>
      </div>
    );
  }

  // Ohne Anmeldung nur den Login-Screen zeigen.
  if (!currentUserId) return <LoginView />;

  return (
    <div>
      <SyncBanner />
      <TopBar module={module} onModule={setModule} />

      {module === 'board' && (
        <>
          <KpiHeader />
          <div className="layout">
            <FilterSidebar />
            <Board />
            <RightColumn />
          </div>
        </>
      )}

      {module === 'zeiterfassung' && <ZeiterfassungBoard />}
      {module === 'planung' && <PlanungView />}

      {module === 'laufende' && <LaufendeView />}

      {module === 'controlling' && <ControllingView />}

      {module === 'verwaltung' && isAdmin && <VerwaltungView />}

      {module === 'zeiten' && <ZeitenView />}
      {module === 'aufgaben' && <AufgabenView />}
      {module === 'freigaben' && <FreigabenView />}

      {openCardId && <OrderModal orderId={openCardId} />}
      <UserModal />
    </div>
  );
}
