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
import { VerwaltungView } from '@/features/verwaltung/VerwaltungView';
import { UserModal } from '@/features/verwaltung/UserModal';
import { LoginView } from '@/features/auth/LoginView';
import { SyncBanner } from '@/app/SyncBanner';
import { useStore } from '@/state/store';
import { API_MODE } from '@/api/mode';
import { apiRestore } from '@/api/session';

export type ModuleKey = 'board' | 'planung' | 'laufende' | 'controlling' | 'zeiten' | 'freigaben' | 'verwaltung';

export function App() {
  const [module, setModule] = useState<ModuleKey>('board');
  // Server-Modus: beim Start eine bestehende Session (Cookie) wiederherstellen,
  // bevor der Login-Bildschirm aufblitzt.
  const [restoring, setRestoring] = useState(API_MODE);
  const openCardId = useStore((s) => s.openCardId);
  const currentUserId = useStore((s) => s.currentUserId);

  useEffect(() => {
    if (API_MODE) void apiRestore().finally(() => setRestoring(false));
  }, []);

  if (restoring) {
    return (
      <div className="login">
        <div className="login__card"><p className="muted">Anmeldung wird geprüft …</p></div>
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

      {module === 'planung' && <PlanungView />}

      {module === 'laufende' && <LaufendeView />}

      {module === 'controlling' && <ControllingView />}

      {module === 'verwaltung' && <VerwaltungView />}

      {module === 'zeiten' && <ZeitenView />}
      {module === 'freigaben' && <FreigabenView />}

      {openCardId && <OrderModal orderId={openCardId} />}
      <UserModal />
    </div>
  );
}
