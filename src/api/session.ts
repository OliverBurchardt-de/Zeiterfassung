import { api, ApiError } from './client';
import { mapApiUser, mapBoardOrder } from './mapping';
import { useStore } from '@/state/store';
import type { ApiUser } from './types';

/**
 * Sitzungs-Steuerung im Server-Modus: Login/Logout/Wiederherstellen + Laden der Aufträge.
 * Schreibt die Ergebnisse in den bestehenden Zustand-Store — die Komponenten bleiben unverändert
 * (gleiche Selektoren wie im Demo-Modus, nur die Quelle der Daten wechselt).
 */

async function hydrate(u: ApiUser): Promise<void> {
  const board = await api.board();
  useStore.setState((s) => ({
    currentUserId: u.id,
    role: u.role,
    isAdmin: u.admin,
    syncError: null,
    // Der angemeldete Nutzer ersetzt einen etwaigen alten Eintrag; weitere Nutzer kommen mit der Nutzer-API.
    users: [mapApiUser(u), ...s.users.filter((x) => x.id !== u.id)],
    orders: board.map(mapBoardOrder),
  }));
}

/** Echter Login gegen den Server; wirft ApiError (401 = falsche Zugangsdaten). */
export async function apiLogin(username: string, password: string): Promise<void> {
  const u = await api.login(username, password);
  await hydrate(u);
}

/** Beim App-Start: bestehende Session (Cookie) wiederverwenden; ohne gültige Session still bleiben. */
export async function apiRestore(): Promise<void> {
  try {
    const u = await api.me();
    await hydrate(u);
  } catch (err) {
    if (err instanceof ApiError) return; // nicht angemeldet oder Server (noch) nicht erreichbar → Login-Bildschirm
    throw err;
  }
}

/** Session serverseitig beenden; lokal in jedem Fall abmelden. */
export async function apiLogout(): Promise<void> {
  try {
    await api.logout();
  } catch {
    // Server nicht erreichbar → trotzdem lokal abmelden.
  } finally {
    useStore.setState({ currentUserId: null, role: 'mitarbeiter', isAdmin: false, orders: [], syncError: null });
  }
}

/** Aufträge neu vom Server laden (z. B. nach einer Schreibaktion in Etappe 2). */
export async function apiReloadOrders(): Promise<void> {
  const board = await api.board();
  useStore.setState({ orders: board.map(mapBoardOrder) });
}
