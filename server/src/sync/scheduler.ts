import type { SyncLogger } from './syncOrders';

/**
 * Der Zeitplaner — die „innere Uhr" des Servers (docs/synchronisierung-konzept.md §3). Kein
 * externer Cron/Windows-Aufgabenplaner: der laufende Server rechnet selbst aus, wann er wieder
 * aufwachen muss, und stellt sich per setTimeout/setInterval seinen Wecker.
 */

/**
 * Millisekunden von `now` bis zum naechsten Eintreten von `HH:MM` (lokale Zeit). Liegt die Uhrzeit
 * heute schon in der Vergangenheit (oder ist genau jetzt), zaehlt sie fuer morgen. Reine Rechnung —
 * daher gut testbar.
 */
export function msUntilTime(hhmm: string, now: Date): number {
  const [h, m] = hhmm.split(':').map(Number);
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export interface SchedulerHandle {
  stop(): void;
}

/** Fuehrt `fn` jeden Tag um `hhmm` aus und stellt den Wecker danach selbst neu. */
export function scheduleDaily(hhmm: string, fn: () => Promise<void>, log: SyncLogger): SchedulerHandle {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const arm = (): void => {
    const delay = msUntilTime(hhmm, new Date());
    timer = setTimeout(run, delay);
    // unref: der Wecker haelt den Prozess nicht kuenstlich am Leben (der HTTP-Server tut das).
    if (typeof timer.unref === 'function') timer.unref();
  };
  const run = async (): Promise<void> => {
    if (stopped) return;
    try {
      await fn();
    } catch (err) {
      log(`[Scheduler] Lauf um ${hhmm} fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!stopped) arm();
  };

  arm();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

/** Fuehrt `fn` alle `ms` Millisekunden aus (Delta-Lauf / Outbox-Arbeiter). */
export function scheduleInterval(ms: number, fn: () => Promise<void>, log: SyncLogger): SchedulerHandle {
  let stopped = false;
  const timer = setInterval(async () => {
    if (stopped) return;
    try {
      await fn();
    } catch (err) {
      log(`[Scheduler] Intervall-Lauf fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, ms);
  if (typeof timer.unref === 'function') timer.unref();
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
