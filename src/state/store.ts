import { create } from 'zustand';
import type { Order, Role, StatusId, ArtKey, Note, NoteState, Attachment, Besonderheit } from '@/lib/types';
import { MOCK_ORDERS, MOCK_BESONDERHEITEN } from '@/mock/orders';

/** Schlüssel der Besonderheiten: Mandantennummer + Auftragsart (period-unabhängig). */
export const besKey = (mandantNr: string, artKey: ArtKey) => `${mandantNr}::${artKey}`;

/** Kontext des geöffneten Besonderheiten-Dialogs */
export interface BesContext {
  mandantNr: string;
  mandant: string;
  artKey: ArtKey;
  art: string;
}

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
  checklistOpenId: string | null;
  besonderheiten: Record<string, Besonderheit[]>;
  besOpen: BesContext | null;

  // UI
  setRole: (role: Role) => void;
  setEmployee: (id: string | 'team') => void;
  setMonat: (m: string | 'alle') => void;
  setVj: (vj: number | 'alle') => void;
  toggleArt: (a: ArtKey) => void;
  toggleQuick: (key: 'nurOffeneZeiten' | 'freigabeAusstehend') => void;
  openCard: (id: string) => void;
  closeCard: () => void;
  openChecklist: (id: string) => void;
  closeChecklist: () => void;

  // Mandantenbesonderheiten (je Mandant + Auftragsart)
  openBesonderheiten: (o: Order) => void;
  closeBesonderheiten: () => void;
  addBesonderheit: (key: string, text: string, author: string) => void;
  editBesonderheit: (key: string, id: string, text: string) => void;
  removeBesonderheit: (key: string, id: string) => void;

  // Auftrag
  setStatus: (orderId: string, status: StatusId) => void;
  requestUmplanung: (orderId: string, zielMonat: string) => void;
  approveUmplanung: (orderId: string) => void;

  // Timer / Zeiten
  startTimer: (orderId: string) => void;
  pauseTimer: (orderId: string) => void;
  resetTimer: (orderId: string) => void;
  tick: (orderId: string) => void;
  transferTimer: (orderId: string, notiz?: string) => void;
  addManualTime: (orderId: string, datum: string, dauer: number, notiz?: string) => void;
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
  checklistOpenId: null,
  besonderheiten: MOCK_BESONDERHEITEN,
  besOpen: null,

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
  openChecklist: (id) => set({ checklistOpenId: id }),
  closeChecklist: () => set({ checklistOpenId: null }),

  openBesonderheiten: (o) => set({ besOpen: { mandantNr: o.mandantNr, mandant: o.mandant, artKey: o.artKey, art: o.art } }),
  closeBesonderheiten: () => set({ besOpen: null }),
  addBesonderheit: (key, text, author) => set((s) => ({
    besonderheiten: {
      ...s.besonderheiten,
      [key]: [...(s.besonderheiten[key] ?? []), { id: uid(), text, author, datum: new Date().toISOString().slice(0, 10) }],
    },
  })),
  editBesonderheit: (key, id, text) => set((s) => ({
    besonderheiten: {
      ...s.besonderheiten,
      [key]: (s.besonderheiten[key] ?? []).map((b) => (b.id === id ? { ...b, text } : b)),
    },
  })),
  removeBesonderheit: (key, id) => set((s) => ({
    besonderheiten: {
      ...s.besonderheiten,
      [key]: (s.besonderheiten[key] ?? []).filter((b) => b.id !== id),
    },
  })),

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
  transferTimer: (orderId, notiz) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => {
      const dauer = Math.round(((o.timerSec ?? 0) / 3600) * 100) / 100;
      if (dauer <= 0) return { ...o, timerRunning: false };
      const entry = { id: uid(), datum: new Date().toISOString().slice(0, 10), dauer, freigegeben: false, notiz: notiz?.trim() || undefined };
      return { ...o, times: [...o.times, entry], timerRunning: false, timerSec: 0 };
    }),
  })),
  addManualTime: (orderId, datum, dauer, notiz) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({
      ...o, times: [...o.times, { id: uid(), datum, dauer, freigegeben: false, notiz: notiz?.trim() || undefined }],
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
