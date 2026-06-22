import { useState } from 'react';
import { TopBar } from '@/app/TopBar';
import { KpiHeader } from '@/app/KpiHeader';
import { FilterSidebar } from '@/features/board/FilterSidebar';
import { Board } from '@/features/board/Board';
import { RightColumn } from '@/features/board/RightColumn';
import { OrderModal } from '@/features/order/OrderModal';
import { LaufendeView } from '@/features/laufende/LaufendeView';
import { PlanungView } from '@/features/planung/PlanungView';
import { ControllingView } from '@/features/controlling/ControllingView';
import { VerwaltungView } from '@/features/verwaltung/VerwaltungView';
import { UserModal } from '@/features/verwaltung/UserModal';
import { BesonderheitenModal } from '@/features/besonderheiten/BesonderheitenModal';
import { ChecklistModal } from '@/features/checklist/ChecklistModal';
import { useStore } from '@/state/store';

export type ModuleKey = 'board' | 'planung' | 'laufende' | 'controlling' | 'zeiten' | 'freigaben' | 'verwaltung';

export function App() {
  const [module, setModule] = useState<ModuleKey>('board');
  const openCardId = useStore((s) => s.openCardId);

  return (
    <div>
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

      {module === 'zeiten' && (
        <Placeholder title="Meine Zeiten" hint="Persönliche Zeitübersicht und Freigabestatus (in Vorbereitung)." />
      )}
      {module === 'freigaben' && (
        <Placeholder title="Freigaben" hint="Umplanungs- und Zeit-Freigaben für den mandatsverantwortlichen Partner (in Vorbereitung)." />
      )}

      {openCardId && <OrderModal orderId={openCardId} />}
      <BesonderheitenModal />
      <ChecklistModal />
      <UserModal />
    </div>
  );
}

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="placeholder">
      <div className="panel">
        <h1 style={{ fontSize: 'var(--bk-fs-h1)' }}>{title}</h1>
        <p className="muted">{hint}</p>
      </div>
    </div>
  );
}
