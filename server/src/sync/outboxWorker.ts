import type { OutboxRepository, DatevPort, ExpensePosting } from '../domain/ports';
import type { SyncLogger } from './syncOrders';

/**
 * Outbox-Arbeiter (Konzept §4 Richtung B): leert die Rueckschreibe-Warteschlange nach DATEV.
 * Erfolg → `markUebertragen`; ein erneut versuchbarer Fehler → `markFehlversuch` (bleibt 'offen',
 * naechster Durchlauf probiert erneut); nach `maxAttempts` erfolglosen Versuchen → `markFehler`
 * (endgueltig, zur manuellen Pruefung — statt ewig weiterzuprobieren).
 *
 * Ist DATEV/VPN kurz weg, geht nichts verloren: die Eintraege bleiben in der Warteschlange.
 */
export interface OutboxDrainOptions {
  /** Wie viele Eintraege je Durchlauf. */
  limit?: number;
  /** Ab wie vielen Fehlversuchen ein Eintrag endgueltig als Fehler gilt. */
  maxAttempts?: number;
}

export async function runOutboxDrain(
  outbox: OutboxRepository,
  datev: DatevPort,
  log: SyncLogger,
  opts: OutboxDrainOptions = {}
): Promise<{ sent: number; retried: number; failed: number }> {
  const limit = opts.limit ?? 50;
  const maxAttempts = opts.maxAttempts ?? 5;
  const batch = await outbox.nextOpen(limit);
  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const entry of batch) {
    try {
      if (entry.kind === 'expense-posting') {
        const posting = JSON.parse(entry.payload) as ExpensePosting;
        await datev.postExpensePosting(posting);
      } else {
        // order-put/suborder-put (Status-/Plandaten-Rueckschreibung) folgen mit den zugehoerigen
        // Fach-Aktionen; bis dahin gezielt als Fehlversuch behandeln statt still zu schlucken.
        throw new Error(`Outbox-Art '${entry.kind}' noch nicht unterstuetzt`);
      }
      await outbox.markUebertragen(entry.id);
      sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (entry.attempts + 1 >= maxAttempts) {
        await outbox.markFehler(entry.id, msg);
        failed += 1;
      } else {
        await outbox.markFehlversuch(entry.id, msg);
        retried += 1;
      }
    }
  }

  if (batch.length > 0) {
    log(`[Outbox] ${batch.length} verarbeitet — ${sent} uebertragen, ${retried} zur Wiederholung, ${failed} endgueltig fehlerhaft.`);
  }
  return { sent, retried, failed };
}
