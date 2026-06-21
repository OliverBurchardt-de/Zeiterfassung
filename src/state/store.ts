import { create } from 'zustand';
import type { Order, Role, StatusId, ArtKey, Note, NoteState, Attachment } from '@/lib/types';
import { MOCK_ORDERS } from '@/mock/orders';

/**
 * Single Source of Truth: orders[].
 * Alle Mutationen laufen immutabel über das jeweilige Order-Objekt.
 * In Produktion wird der orders-Teil durch Server-State (TanStack Query /
 * DATEV-EO) ersetzt; UI-State (role, Filter, openCardId, Timer) bleibt lokal.
 */

export interface Filters {
  employeeId: string | 'team';
  monat: string | 'alle';
  vj: number | 'alle'; // Veranlagungsjahr
  arten: ArtKey[]; // leere Liste = alle
  nurOffeneZeiten: boolean;
  freigabeAusstehend: boolean;
}

interface AppState {
  orders: Order[];
  role: Role;
  filters: Filters;
  openCardId: string | null;

  // UI
  setRole: (role: Role) => void;
  setEmployee: (id: string | 'team') => void;
  setMonat: (m: string | 'alle') => void;
  setVj: (vj: number | 'alle') => void;
  toggleArt: (a: ArtKey) => void;
  toggleQuick: (key: 'nurOffeneZeiten' | 'freigabeAusstehend') => void;
  openCard: (id: string) => void;
  closeCard: () => void;

  // Auftrag
  setStatus: (orderId: string, status: StatusId) => void;
  requestUmplanung: (orderId: string, zielMonat: string) => void;
  approveUmplanung: (orderId: string) => void;

  // Timer / Zeiten
  startTimer: (orderId: string) => void;
  pauseTimer: (orderId: string) => void;
  resetTimer: (orderId: string) => void;
  tick: (orderId: string) => void;
  transferTimer: (orderId: string) => void;
  addManualTime: (orderId: string, datum: string, dauer: number) => void;
  approveTime: (orderId: string, timeId: string) => void;

  // Checkliste
  toggleCheck: (orderId: string, itemId: string) => void;
  addCheck: (orderId: string, label: string) => void;
  removeCheck: (orderId: string, itemId: string) => void;

  // Review Notes / Fragen
  addNote: (orderId: string, text: string, role: Role, author: string, attachments?: Attachment[]) => void;
  editNoteText: (orderId: string, noteId: string, text: string) => void;
  addComment: (orderId: string, noteId: string, text: string, role: Role, author: string) => void;
  setNoteState: (orderId: string, noteId: string, state: NoteState) => void;
  deleteNote: (orderId: string, noteId: string) => void;
  addAttachments: (orderId: string, noteId: string, attachments: Attachment[]) => void;
  removeAttachment: (orderId: string, noteId: string, attachmentId: string) => void;
}

const uid = () => crypto.randomUUID();

/** Helper: ein Order finden & immutabel ersetzen */
function mapOrder(orders: Order[], id: string, fn: (o: Order) => Order): Order[] {
  return orders.map((o) => (o.id === id ? fn(o) : o));
}

function mapNote(o: Order, noteId: string, fn: (n: Note) => Note): Order {
  return { ...o, notes: o.notes.map((n) => (n.id === noteId ? fn(n) : n)) };
}

export const useStore = create<AppState>((set) => ({
  orders: MOCK_ORDERS,
  role: 'mitarbeiter',
  filters: { employeeId: 'sw', monat: 'alle', vj: 'alle', arten: [], nurOffeneZeiten: false, freigabeAusstehend: false },
  openCardId: null,

  setRole: (role) => set({ role }),
  setEmployee: (employeeId) => set((s) => ({ filters: { ...s.filters, employeeId } })),
  setMonat: (monat) => set((s) => ({ filters: { ...s.filters, monat } })),
  setVj: (vj) => set((s) => ({ filters: { ...s.filters, vj } })),
  toggleArt: (a) => set((s) => {
    const has = s.filters.arten.includes(a);
    return { filters: { ...s.filters, arten: has ? s.filters.arten.filter((x) => x !== a) : [...s.filters.arten, a] } };
  }),
  toggleQuick: (key) => set((s) => ({ filters: { ...s.filters, [key]: !s.filters[key] } })),
  openCard: (id) => set({ openCardId: id }),
  closeCard: () => set({ openCardId: null }),

  setStatus: (orderId, status) => set((s) => ({ orders: mapOrder(s.orders, orderId, (o) => ({ ...o, status })) })),

  requestUmplanung: (orderId, zielMonat) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({ ...o, umplanung: { zielMonat, freigabeAusstehend: true } })),
  })),
  approveUmplanung: (orderId) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) =>
      o.umplanung ? { ...o, monat: o.umplanung.zielMonat, umplanung: null } : o),
  })),

  startTimer: (orderId) => set((s) => ({ orders: mapOrder(s.orders, orderId, (o) => ({ ...o, timerRunning: true })) })),
  pauseTimer: (orderId) => set((s) => ({ orders: mapOrder(s.orders, orderId, (o) => ({ ...o, timerRunning: false })) })),
  resetTimer: (orderId) => set((s) => ({ orders: mapOrder(s.orders, orderId, (o) => ({ ...o, timerRunning: false, timerSec: 0 })) })),
  tick: (orderId) => set((s) => ({ orders: mapOrder(s.orders, orderId, (o) => ({ ...o, timerSec: (o.timerSec ?? 0) + 1 })) })),
  transferTimer: (orderId) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => {
      const dauer = Math.round(((o.timerSec ?? 0) / 3600) * 100) / 100;
      if (dauer <= 0) return { ...o, timerRunning: false };
      const entry = { id: uid(), datum: new Date().toISOString().slice(0, 10), dauer, freigegeben: false };
      return { ...o, times: [...o.times, entry], timerRunning: false, timerSec: 0 };
    }),
  })),
  addManualTime: (orderId, datum, dauer) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({
      ...o, times: [...o.times, { id: uid(), datum, dauer, freigegeben: false }],
    })),
  })),
  approveTime: (orderId, timeId) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({
      ...o, times: o.times.map((t) => (t.id === timeId ? { ...t, freigegeben: true } : t)),
    })),
  })),

  toggleCheck: (orderId, itemId) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({
      ...o, checklist: o.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)),
    })),
  })),
  addCheck: (orderId, label) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({ ...o, checklist: [...o.checklist, { id: uid(), label, done: false }] })),
  })),
  removeCheck: (orderId, itemId) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({ ...o, checklist: o.checklist.filter((c) => c.id !== itemId) })),
  })),

  addNote: (orderId, text, role, author, attachments = []) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({
      ...o,
      notes: [...o.notes, {
        id: uid(), text, author, comments: [], attachments,
        kind: role === 'partner' ? 'review' : 'frage',
        noteState: 'offen',
      }],
    })),
  })),
  editNoteText: (orderId, noteId, text) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => mapNote(o, noteId, (n) => ({ ...n, text }))),
  })),
  addComment: (orderId, noteId, text, role, author) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => mapNote(o, noteId, (n) => ({
      ...n, comments: [...n.comments, { id: uid(), text, author, role }],
    }))),
  })),
  setNoteState: (orderId, noteId, state) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => mapNote(o, noteId, (n) => ({ ...n, noteState: state }))),
  })),
  deleteNote: (orderId, noteId) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({ ...o, notes: o.notes.filter((n) => n.id !== noteId) })),
  })),
  addAttachments: (orderId, noteId, attachments) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => mapNote(o, noteId, (n) => ({
      ...n, attachments: [...n.attachments, ...attachments],
    }))),
  })),
  removeAttachment: (orderId, noteId, attachmentId) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => mapNote(o, noteId, (n) => ({
      ...n, attachments: n.attachments.filter((a) => a.id !== attachmentId),
    }))),
  })),
}));

/**
 * Ist eine Note noch „offen" (= erfordert Aufmerksamkeit)?
 * Frage:  nur solange noch nicht erledigt (kein Freigabe-Schritt).
 * Review: bis der Partner freigegeben hat (offen oder „wartet auf Freigabe").
 */
export function noteOffen(n: Note): boolean {
  return n.kind === 'frage' ? n.noteState === 'offen' : n.noteState !== 'freigegeben';
}

/** Anzahl offener Notes/Fragen (für Karten-Badge & Kopfzeile) */
export function offeneNotes(o: Order): number {
  return o.notes.filter(noteOffen).length;
}
