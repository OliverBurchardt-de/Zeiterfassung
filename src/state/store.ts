import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Order, Role, StatusId, ArtKey, Note, NoteState, Attachment, Besonderheit, User, Aufwandsart, AuftragsAnforderung, Task, TaskStatus, Stopwatch } from '@/lib/types';
import { MOCK_ORDERS, MOCK_BESONDERHEITEN } from '@/mock/orders';
import { heute } from '@/lib/heute';
import { MOCK_USERS } from '@/mock/users';
import { MOCK_TASKS } from '@/mock/tasks';
import { monatBounds } from '@/lib/monate';
import { hasUnterlagenProzess } from '@/lib/art';
import { umplanungFreiMoeglich } from '@/lib/regeln';
import { CHECKLIST_TEMPLATES_BY_ORDERTYPE } from '@/lib/checklists';
import { notePolicy } from '@/lib/tokens';
import { API_MODE } from '@/api/mode';
import { write } from '@/api/write';

/**
 * Schlüssel der Besonderheiten: Mandantennummer + **Ordertype** (period-unabhängig).
 * Bewusst der konkrete Ordertype (nicht der grobe artKey-Bucket) — deckungsgleich mit dem
 * DB-Design (`Besonderheit clientId+ordertype`) und `docs/datev-integration.md`; sonst teilten
 * sich z. B. Monats-/Quartals-/Jahres-FiBu (106/107/108) fälschlich dieselben Einträge.
 */
export const besKey = (mandantNr: string, ordertype: string) => `${mandantNr}::${ordertype}`;

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
  suche: string; // Freitext: Mandant / Auftrags-Nr.
}

/** Daten eines Nutzers im Bearbeiten-/Anlegen-Dialog (ohne id/Status). */
export type UserDraft = Omit<User, 'id' | 'aktiv'>;

/** Eingabedaten einer neuen Auftrags-Anforderung (ohne Meta/Status, die der Store setzt). */
export type AnforderungDraft = Pick<AuftragsAnforderung, 'mandant' | 'mandantNr' | 'ordertype' | 'art' | 'vj' | 'zeitraum' | 'notiz'>;

/** Eingabedaten einer neuen Aufgabe (Meta wie id/Urheber/Status/Position setzt der Store). */
export type TaskDraft = Pick<Task, 'titel' | 'beschreibung' | 'zugewiesenAnId' | 'zugewiesenAn' | 'faelligkeit' | 'orderId'>;

interface AppState {
  orders: Order[];
  currentUserId: string | null; // angemeldeter Nutzer (Mock-Login); null = nicht angemeldet
  login: (userId: string) => void;
  logout: () => void;
  role: Role; // wird beim Login aus dem Nutzer gesetzt
  isAdmin: boolean; // Admin-Zusatzrecht → Modul „Verwaltung" sichtbar (beim Login aus dem Nutzer)
  filters: Filters;
  openCardId: string | null;
  besonderheiten: Record<string, Besonderheit[]>;

  /**
   * Letzte fehlgeschlagene Server-Schreibaktion (nur Server-Modus) — wird als Hinweisleiste
   * angezeigt und beim nächsten erfolgreichen Board-Reload/Klick verworfen. Null = kein Fehler.
   */
  syncError: string | null;
  setSyncError: (msg: string | null) => void;

  // Nutzerverwaltung (Modul „Verwaltung")
  users: User[];
  userEditId: string | 'new' | null; // offener Nutzer-Dialog
  openUserEdit: (id: string | 'new') => void;
  closeUserEdit: () => void;
  addUser: (draft: UserDraft) => void;
  editUser: (id: string, draft: UserDraft) => void;
  setUserActive: (id: string, aktiv: boolean) => void;

  // UI
  setEmployee: (id: string | 'team') => void;
  setMonat: (m: string | 'alle') => void;
  setVj: (vj: number | 'alle') => void;
  setSuche: (q: string) => void;
  toggleArt: (a: ArtKey) => void;
  toggleQuick: (key: 'nurOffeneZeiten' | 'freigabeAusstehend') => void;
  openCard: (id: string) => void;
  closeCard: () => void;

  // Mandantenbesonderheiten (je Mandant + Auftragsart) — Bedienung im Detail-Flyout
  addBesonderheit: (key: string, text: string, author: string) => void;
  editBesonderheit: (key: string, id: string, text: string) => void;
  removeBesonderheit: (key: string, id: string) => void;

  // Auftrag
  setStatus: (orderId: string, status: StatusId) => void;
  assignOrder: (orderId: string, bearbeiterId: string, bearbeiter: string) => void;
  planOrder: (orderId: string, monat: string) => void; // Auftrag in einen Monat einplanen (setzt Start/Ende)
  /**
   * Einplanung aufheben (zurück in den Pool). Standard (Partner/Admin): VJ-Kontingent zurücksetzen.
   * `kontingentVerbrauchen` (Mitarbeiter-Weg): zählt stattdessen +1 — sonst ließe sich die
   * Partner-Freigabe über „Pool und neu ziehen" umgehen (Review-Befund 6).
   */
  unplanOrder: (orderId: string, opts?: { kontingentVerbrauchen?: boolean }) => void;
  /**
   * Freie (Um-)Planung ohne Partner-Freigabe. Guard im Store (SSOT): nur wenn
   * `umplanungFreiMoeglich` — es sei denn `erzwungen` (Partner/Admin verschiebt selbst; zählt
   * wie eine freigegebene Umplanung). Erstplanung und Ziel = aktueller Monat verbrauchen NICHTS.
   */
  umplanen: (orderId: string, zielMonat: string, opts?: { erzwungen?: boolean }) => void;
  requestUmplanung: (orderId: string, zielMonat: string) => void;
  approveUmplanung: (orderId: string) => void;
  rejectUmplanung: (orderId: string) => void; // Partner lehnt ab → Monat bleibt, Ablehnung bleibt als Hinweis sichtbar
  dismissUmplanungAblehnung: (orderId: string) => void; // Mitarbeiter nimmt die Ablehnung zur Kenntnis

  // Timer / Zeiten — der Timer basiert auf einem Start-Zeitstempel (timerStartedAt), nicht auf
  // UI-Ticks: die Zeit läuft damit auch bei geschlossenem Detail und über Reloads korrekt weiter.
  startTimer: (orderId: string) => void;
  pauseTimer: (orderId: string) => void;
  resetTimer: (orderId: string) => void;
  transferTimer: (orderId: string, notiz?: string) => void;
  addManualTime: (orderId: string, datum: string, dauer: number, notiz?: string, aufwandsart?: Aufwandsart, startMin?: number, onBehalfOfUserId?: string) => void;
  releaseTime: (orderId: string, timeId: string) => void; // Mitarbeiter gibt eigene Zeit frei (erfasst → freigegeben)
  withdrawTime: (orderId: string, timeId: string) => void; // Freigabe zurückziehen (freigegeben → erfasst), solange nicht übertragen
  deleteTime: (orderId: string, timeId: string) => void; // Fehlbuchung löschen — NUR solange Status 'erfasst'

  // Teilaufträge (Monate, FiBu/Lohn)
  setSuborderDone: (orderId: string, suborderId: string, done: boolean) => void;

  // Auftrags-Anforderungen (Workflow-Mock: Mitarbeiter → Backoffice-Inbox)
  anforderungen: AuftragsAnforderung[];
  addAnforderung: (draft: AnforderungDraft, user: User) => void;
  setAnforderungAngelegt: (id: string) => void;
  setAnforderungAbgelehnt: (id: string, grund: string) => void;
  removeAnforderung: (id: string) => void; // Urheber zieht eine offene Anforderung zurück

  // Checklisten-Vorlagen je Auftragsart (Ordertype) — gepflegt in der Verwaltung
  checklistTemplates: Record<string, string[]>;
  addChecklistTemplateItem: (ordertype: string, label: string) => void;
  editChecklistTemplateItem: (ordertype: string, index: number, label: string) => void;
  removeChecklistTemplateItem: (ordertype: string, index: number) => void;
  setChecklistTemplate: (ordertype: string, items: string[]) => void; // ganze Liste ersetzen (z. B. Import)
  resetChecklistTemplate: (ordertype: string) => void; // zurück auf die voreingestellte Vorlage

  // Checkliste
  /**
   * Server-Modus: Checkliste eines Auftrags einmalig aus Vorlagen-Labels instanziieren
   * (idempotent serverseitig). Demo-Modus: No-Op (Aufträge tragen ihre Checkliste bereits).
   */
  ensureChecklist: (orderId: string, labels: string[]) => void;
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

  // Aufgaben (Modul „Aufgaben" + To-Do-Bereich im Auftrag). App-intern, kein DATEV-Bezug.
  // Server-Persistenz folgt als Etappe (aktuell wie die übrigen lokalen Teile im Browser gehalten).
  tasks: Task[];
  addTask: (draft: TaskDraft, author: User) => void;
  updateTask: (id: string, patch: Partial<Pick<Task, 'titel' | 'beschreibung' | 'faelligkeit' | 'orderId'>>) => void;
  assignTask: (id: string, userId: string, userName: string) => void; // Aufgabe einem Kollegen (neu) zuweisen
  setTaskStatus: (id: string, status: TaskStatus) => void; // abhaken / wieder öffnen
  reorderTasks: (orderedIds: string[]) => void; // manuelle Reihenfolge nach Drag & Drop festschreiben
  deleteTask: (id: string) => void;

  // Stoppuhr (Zeiterfassungs-Board) — genau EINE gleichzeitig. Das Buchen der verstrichenen Zeit
  // erledigt die Board-Komponente über addManualTime; hier liegt nur der laufende Zustand.
  stopwatch: Stopwatch | null;
  setStopwatch: (sw: Stopwatch | null) => void;
  setStopwatchNotiz: (notiz: string) => void;
}

const uid = () => crypto.randomUUID();

/** Helper: ein Order finden & immutabel ersetzen */
function mapOrder(orders: Order[], id: string, fn: (o: Order) => Order): Order[] {
  return orders.map((o) => (o.id === id ? fn(o) : o));
}

function mapNote(o: Order, noteId: string, fn: (n: Note) => Note): Order {
  return { ...o, notes: o.notes.map((n) => (n.id === noteId ? fn(n) : n)) };
}

/**
 * Aktueller Timer-Stand in Sekunden: eingefrorene Basis (timerSec) plus die seit dem Start
 * verstrichene Echtzeit. Läuft damit unabhängig davon, ob ein UI-Intervall tickt — auch bei
 * geschlossenem Detail und über Reloads (timerStartedAt wird mitpersistiert).
 */
export function timerSeconds(o: Order, nowMs: number = Date.now()): number {
  const basis = o.timerSec ?? 0;
  if (!o.timerRunning || !o.timerStartedAt) return basis;
  return basis + Math.max(0, Math.floor((nowMs - o.timerStartedAt) / 1000));
}

export const useStore = create<AppState>()(persist((set, get) => ({
  // Server-Modus: leer starten — Nutzer/Aufträge kommen nach dem Login vom Server
  // (src/api/session.ts). Demo-Modus: wie gehabt mit Mock-Daten.
  orders: API_MODE ? [] : MOCK_ORDERS,
  currentUserId: null,
  login: (userId) => set((s) => {
    const u = s.users.find((x) => x.id === userId && x.aktiv);
    if (!u) return {};
    // Rolle und Admin-Recht kommen aus dem angemeldeten Nutzer (im Mock; in M2 serverseitig).
    return { currentUserId: u.id, role: u.role, isAdmin: u.admin };
  }),
  logout: () => set({ currentUserId: null }),
  role: 'mitarbeiter',
  isAdmin: false,
  filters: { employeeId: 'team', monat: 'alle', vj: 'alle', arten: [], nurOffeneZeiten: false, freigabeAusstehend: false, suche: '' },
  openCardId: null,
  besonderheiten: API_MODE ? {} : MOCK_BESONDERHEITEN,

  syncError: null,
  setSyncError: (msg) => set({ syncError: msg }),

  users: API_MODE ? [] : MOCK_USERS,
  userEditId: null,
  openUserEdit: (id) => set({ userEditId: id }),
  closeUserEdit: () => set({ userEditId: null }),
  addUser: (draft) => set((s) => ({
    users: [...s.users, { ...draft, id: uid(), aktiv: true }],
    userEditId: null,
  })),
  editUser: (id, draft) => set((s) => ({
    users: s.users.map((u) => (u.id === id ? { ...u, ...draft } : u)),
    userEditId: null,
  })),
  setUserActive: (id, aktiv) => set((s) => ({
    users: s.users.map((u) => (u.id === id ? { ...u, aktiv } : u)),
    // Deaktivierung wirkt sofort: betrifft sie den angemeldeten Nutzer, wird er abgemeldet.
    ...(id === s.currentUserId && !aktiv ? { currentUserId: null } : {}),
  })),

  setEmployee: (employeeId) => set((s) => ({ filters: { ...s.filters, employeeId } })),
  setMonat: (monat) => set((s) => ({ filters: { ...s.filters, monat } })),
  setVj: (vj) => set((s) => ({ filters: { ...s.filters, vj } })),
  setSuche: (suche) => set((s) => ({ filters: { ...s.filters, suche } })),
  toggleArt: (a) => set((s) => {
    const has = s.filters.arten.includes(a);
    return { filters: { ...s.filters, arten: has ? s.filters.arten.filter((x) => x !== a) : [...s.filters.arten, a] } };
  }),
  toggleQuick: (key) => set((s) => ({ filters: { ...s.filters, [key]: !s.filters[key] } })),
  openCard: (id) => set({ openCardId: id }),
  closeCard: () => set({ openCardId: null }),

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

  // Domänen-Guard (SSOT): die in der UI durchgesetzten Kernregeln auch im Store absichern, damit
  // kein anderer Aufruf (Tests, künftige API) einen unzulässigen Zustand erzeugt. Vollständige
  // Übergangs-/Rollenvalidierung folgt serverseitig in M2 (Review P1.1).
  setStatus: (orderId, status) => {
    let changed = false;
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => {
        if (o.status === status) return o; // keine Änderung → nichts historisieren/senden
        if (status === 'er' && o.checklist.some((c) => !c.done)) return o; // „Erledigt" erst bei vollständiger Checkliste
        if ((status === 'ua' || status === 'uv') && !hasUnterlagenProzess(o.ordertype)) return o; // ua/uv nur mit Unterlagen-Prozess
        changed = true;
        return { ...o, status };
      }),
    }));
    // Nur den tatsächlich durchgeführten Wechsel serverseitig festschreiben (Server prüft
    // die „Erledigt"-Checklistensperre erneut; ua/uv-Regel greift bereits oben).
    if (API_MODE && changed) write.setStatus(orderId, status);
  },

  assignOrder: (orderId, bearbeiterId, bearbeiter) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({ ...o, bearbeiterId, bearbeiter })),
  })),
  planOrder: (orderId, monat) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => {
      const b = monatBounds(monat);
      return b ? { ...o, monat, fristStart: b.start, fristEnde: b.end } : o;
    }),
  })),
  unplanOrder: (orderId, opts) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({
      ...o, monat: '', fristStart: '', fristEnde: '', umplanung: null,
      // Partner/Admin (Standard): zurück in den Pool = frische Erstplanung → Kontingent zurück.
      // Mitarbeiter (kontingentVerbrauchen): zählt als genutzte freie Umplanung, damit
      // „Pool und neu ziehen" die Partner-Freigabe nicht umgeht.
      umplanungenVerbraucht: opts?.kontingentVerbrauchen ? (o.umplanungenVerbraucht ?? 0) + 1 : 0,
    })),
  })),

  // Freie (Um-)Planung ohne Partner-Freigabe. Setzt Monat + Fristdaten konsistent
  // (wie planOrder/approveUmplanung). Kontingent-Logik:
  //  - Ziel = aktueller Monat → No-Op (nichts verbrauchen).
  //  - Erstplanung (kein Monat) → frei, verbraucht NICHTS.
  //  - sonst nur wenn umplanungFreiMoeglich (Guard, SSOT) → verbraucht +1.
  //  - erzwungen (Partner/Admin verschiebt direkt) → wie eine freigegebene Umplanung: +1.
  umplanen: (orderId, zielMonat, opts) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => {
      if (o.monat === zielMonat) return o;
      const erstplanung = !o.monat;
      if (!erstplanung && !opts?.erzwungen && !umplanungFreiMoeglich(o)) return o;
      const verbraucht = erstplanung ? (o.umplanungenVerbraucht ?? 0) : (o.umplanungenVerbraucht ?? 0) + 1;
      const b = monatBounds(zielMonat);
      return b
        ? { ...o, monat: zielMonat, fristStart: b.start, fristEnde: b.end, umplanung: null, umplanungenVerbraucht: verbraucht }
        : { ...o, monat: zielMonat, umplanung: null, umplanungenVerbraucht: verbraucht };
    }),
  })),
  requestUmplanung: (orderId, zielMonat) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({ ...o, umplanung: { zielMonat, freigabeAusstehend: true } })),
  })),
  approveUmplanung: (orderId) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => {
      if (!o.umplanung) return o;
      const zielMonat = o.umplanung.zielMonat;
      // Wie planOrder: Monat + Fristdaten konsistent setzen, sonst zeigen Detail/Filter/Controlling
      // widersprüchliche Daten (Review-Hinweis 5.1). Eine freigegebene Umplanung zählt ebenfalls
      // gegen das VJ-Kontingent (Nachvollziehbarkeit der Verschiebungen).
      const b = monatBounds(zielMonat);
      const verbraucht = (o.umplanungenVerbraucht ?? 0) + 1;
      return b
        ? { ...o, monat: zielMonat, fristStart: b.start, fristEnde: b.end, umplanung: null, umplanungenVerbraucht: verbraucht }
        : { ...o, monat: zielMonat, umplanung: null, umplanungenVerbraucht: verbraucht };
    }),
  })),
  rejectUmplanung: (orderId) => set((s) => ({
    // Ablehnung nicht stumm verwerfen: als Hinweis am Auftrag stehen lassen, bis der
    // Mitarbeiter ihn wegklickt (dismiss) oder neu plant/anfordert.
    orders: mapOrder(s.orders, orderId, (o) => (o.umplanung
      ? { ...o, umplanung: { zielMonat: o.umplanung.zielMonat, freigabeAusstehend: false, abgelehnt: true } }
      : o)),
  })),
  dismissUmplanungAblehnung: (orderId) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => (o.umplanung?.abgelehnt ? { ...o, umplanung: null } : o)),
  })),

  startTimer: (orderId) => set((s) => ({
    // Es läuft immer nur EIN Timer: andere laufende werden pausiert (Stand eingefroren) —
    // sonst würde dieselbe Arbeitszeit mehrfach gezählt.
    orders: s.orders.map((o) => {
      if (o.id === orderId) return o.timerRunning ? o : { ...o, timerRunning: true, timerStartedAt: Date.now() };
      if (o.timerRunning) return { ...o, timerSec: timerSeconds(o), timerRunning: false, timerStartedAt: undefined };
      return o;
    }),
  })),
  pauseTimer: (orderId) => set((s) => ({
    // Verstrichene Zeit in timerSec „einfrieren" — nichts geht verloren.
    orders: mapOrder(s.orders, orderId, (o) => ({ ...o, timerSec: timerSeconds(o), timerRunning: false, timerStartedAt: undefined })),
  })),
  resetTimer: (orderId) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({ ...o, timerRunning: false, timerSec: 0, timerStartedAt: undefined })),
  })),
  transferTimer: (orderId, notiz) => {
    // Arbeitsdatum: heute() — Demo: Stichtag HEUTE, Server-Modus: echtes Tagesdatum
    // (die DB soll das reale work_date führen).
    const datum = heute();
    const id = uid();
    const n = notiz?.trim() || undefined;
    // Ownership: im Server-Modus gehört der Eintrag dem Angemeldeten (Server vergibt actor.id
    // identisch); im Demo-Modus kein userId → Fallback über den Auftrags-Bearbeiter.
    const userId = API_MODE ? get().currentUserId ?? undefined : undefined;
    let dauer = 0;
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => {
        const sec = timerSeconds(o);
        dauer = Math.round((sec / 3600) * 100) / 100;
        if (dauer <= 0) return { ...o, timerRunning: false, timerStartedAt: undefined };
        const entry = { id, userId, datum, dauer, status: 'erfasst' as const, notiz: n };
        return { ...o, times: [...o.times, entry], timerRunning: false, timerSec: 0, timerStartedAt: undefined };
      }),
    }));
    if (API_MODE && dauer > 0) write.bookTime(orderId, id, { orderId, datum, dauer, notiz: n });
  },
  addManualTime: (orderId, datum, dauer, notiz, aufwandsart, startMin, onBehalfOfUserId) => {
    // Guard (SSOT): ungültige Eingaben verwerfen — die UI validiert zusätzlich. Vollständige
    // Validierung (Obergrenze, Pflicht-Notiz/Aufwandsart, Erfasser) folgt serverseitig in M2 (Review P1.5).
    if (!(dauer > 0) || !datum) return;
    const id = uid();
    const n = notiz?.trim() || undefined;
    // WER bucht, dem gehoert die Zeit — außer das Backoffice bucht FÜR einen anderen Mitarbeiter
    // (onBehalfOfUserId): dann gehört die Zeit dem Zielnutzer. Server-Modus erzwingt beides ohnehin.
    const userId = onBehalfOfUserId ?? get().currentUserId ?? undefined;
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => ({
        // startMin ist reine Timeline-Anzeige (Zeiterfassungs-Board) — geht NICHT an den Server;
        // DATEV speichert nur datum+dauer (kein work_start_time).
        ...o, times: [...o.times, { id, userId, datum, dauer, status: 'erfasst', notiz: n, aufwandsart, startMin }],
      })),
    }));
    if (API_MODE) write.bookTime(orderId, id, { orderId, datum, dauer, notiz: n, aufwandsart, onBehalfOfUserId });
  },
  // V2-Hook: vor der Freigabe wird die Notiz per API an eine KI gegeben (Kategorie/Rechtschreibung/
  // Aussagekraft prüfen) — siehe src/lib/ki.ts (pruefeNotizKI). Aktuell nur technisch vorgesehen.
  releaseTime: (orderId, timeId) => {
    let changed = false;
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => ({
        ...o,
        times: o.times.map((t) => {
          if (t.id === timeId && t.status === 'erfasst') { changed = true; return { ...t, status: 'freigegeben' }; }
          return t;
        }),
      })),
    }));
    if (API_MODE && changed) write.releaseTime(timeId);
  },
  withdrawTime: (orderId, timeId) => {
    let changed = false;
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => ({
        ...o,
        times: o.times.map((t) => {
          if (t.id === timeId && t.status === 'freigegeben') { changed = true; return { ...t, status: 'erfasst' }; }
          return t;
        }),
      })),
    }));
    if (API_MODE && changed) write.withdrawTime(timeId);
  },
  deleteTime: (orderId, timeId) => {
    // Guard (SSOT): nur 'erfasst' ist löschbar — freigegeben erst zurückziehen, 'uebertragen'
    // ist unantastbar (Korrektur dann nur in DATEV EO; die API kennt kein DELETE).
    let changed = false;
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => ({
        ...o,
        times: o.times.filter((t) => {
          if (t.id === timeId && t.status === 'erfasst') { changed = true; return false; }
          return true;
        }),
      })),
    }));
    // Nur den lokal gelöschten (erfassten) Eintrag serverseitig entfernen — der Server ließe auch
    // 'freigegeben' löschen; hier bewusst an die engere lokale Regel gebunden.
    if (API_MODE && changed) write.deleteTime(timeId);
  },

  setSuborderDone: (orderId, suborderId, done) => set((s) => ({
    orders: mapOrder(s.orders, orderId, (o) => ({
      ...o,
      suborders: o.suborders?.map((sb) =>
        sb.id === suborderId ? { ...sb, erledigtAm: done ? new Date().toISOString().slice(0, 10) : undefined } : sb),
    })),
  })),

  anforderungen: [],
  addAnforderung: (draft, user) => set((s) => {
    if (!draft.mandant.trim() || !draft.ordertype || !draft.notiz.trim()) return {};
    const a: AuftragsAnforderung = {
      ...draft, id: uid(),
      erstelltVon: user.name, erstelltVonId: user.id,
      erstelltAm: new Date().toISOString().slice(0, 10),
      status: 'angefordert',
    };
    return { anforderungen: [a, ...s.anforderungen] };
  }),
  setAnforderungAngelegt: (id) => set((s) => ({
    anforderungen: s.anforderungen.map((a) =>
      a.id === id ? { ...a, status: 'angelegt', erledigtAm: new Date().toISOString().slice(0, 10), grund: undefined } : a),
  })),
  setAnforderungAbgelehnt: (id, grund) => set((s) => ({
    anforderungen: s.anforderungen.map((a) =>
      a.id === id ? { ...a, status: 'abgelehnt', erledigtAm: new Date().toISOString().slice(0, 10), grund: grund.trim() || undefined } : a),
  })),
  removeAnforderung: (id) => set((s) => ({ anforderungen: s.anforderungen.filter((a) => a.id !== id) })),

  checklistTemplates: CHECKLIST_TEMPLATES_BY_ORDERTYPE,
  addChecklistTemplateItem: (ordertype, label) => set((s) => {
    const t = label.trim();
    if (!t) return {};
    return { checklistTemplates: { ...s.checklistTemplates, [ordertype]: [...(s.checklistTemplates[ordertype] ?? []), t] } };
  }),
  editChecklistTemplateItem: (ordertype, index, label) => set((s) => ({
    checklistTemplates: {
      ...s.checklistTemplates,
      [ordertype]: (s.checklistTemplates[ordertype] ?? []).map((x, i) => (i === index ? label : x)),
    },
  })),
  removeChecklistTemplateItem: (ordertype, index) => set((s) => ({
    checklistTemplates: {
      ...s.checklistTemplates,
      [ordertype]: (s.checklistTemplates[ordertype] ?? []).filter((_, i) => i !== index),
    },
  })),
  setChecklistTemplate: (ordertype, items) => set((s) => ({
    checklistTemplates: { ...s.checklistTemplates, [ordertype]: items.map((x) => x.trim()).filter(Boolean) },
  })),
  resetChecklistTemplate: (ordertype) => set((s) => ({
    checklistTemplates: { ...s.checklistTemplates, [ordertype]: [...(CHECKLIST_TEMPLATES_BY_ORDERTYPE[ordertype] ?? [])] },
  })),

  ensureChecklist: (orderId, labels) => {
    if (API_MODE) write.ensureChecklist(orderId, labels);
  },
  toggleCheck: (orderId, itemId) => {
    let target: boolean | undefined;
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => ({
        ...o,
        checklist: o.checklist.map((c) => {
          if (c.id !== itemId) return c;
          target = !c.done;
          return { ...c, done: target };
        }),
      })),
    }));
    if (API_MODE && target !== undefined) write.toggleCheck(orderId, itemId, target);
  },
  addCheck: (orderId, label) => {
    const id = uid();
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => ({ ...o, checklist: [...o.checklist, { id, label, done: false, herkunft: 'manuell' as const }] })),
    }));
    if (API_MODE) write.addCheck(orderId, id, label);
  },
  removeCheck: (orderId, itemId) => {
    // Nur manuelle Punkte sind löschbar — Pflichtpunkte aus der Vorlage nie (Review 12.07.2026;
    // fehlende Herkunft gilt fail-safe als 'vorlage'). Der Server erzwingt dieselbe Regel.
    let changed = false;
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => ({
        ...o,
        checklist: o.checklist.filter((c) => {
          if (c.id === itemId && c.herkunft === 'manuell') {
            changed = true;
            return false;
          }
          return true;
        }),
      })),
    }));
    if (API_MODE && changed) write.removeCheck(orderId, itemId);
  },

  addNote: (orderId, text, role, author, attachments = []) => {
    const id = uid();
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => ({
        ...o,
        notes: [...o.notes, {
          id, text, author, comments: [], attachments,
          kind: notePolicy.canCreateKind(role),
          noteState: 'offen',
        }],
      })),
    }));
    // Server leitet die Art (frage/review) aus der Rolle ab (wie notePolicy.canCreateKind); der
    // Text genügt. Anhänge bleiben vorerst lokal (Attachment-API folgt in Etappe 3).
    if (API_MODE) write.createNote(orderId, id, text);
  },
  editNoteText: (orderId, noteId, text) => {
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => mapNote(o, noteId, (n) => ({ ...n, text }))),
    }));
    if (API_MODE) write.editNote(noteId, text);
  },
  addComment: (orderId, noteId, text, role, author) => {
    const id = uid();
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => mapNote(o, noteId, (n) => ({
        ...n, comments: [...n.comments, { id, text, author, role }],
      }))),
    }));
    if (API_MODE) write.comment(orderId, noteId, id, text);
  },
  setNoteState: (orderId, noteId, state) => {
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => mapNote(o, noteId, (n) => ({ ...n, noteState: state }))),
    }));
    if (API_MODE) write.setNoteState(noteId, state);
  },
  deleteNote: (orderId, noteId) => {
    set((s) => ({
      orders: mapOrder(s.orders, orderId, (o) => ({ ...o, notes: o.notes.filter((n) => n.id !== noteId) })),
    }));
    if (API_MODE) write.deleteNote(noteId);
  },
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

  // ---- Aufgaben ----------------------------------------------------------
  tasks: API_MODE ? [] : MOCK_TASKS,
  addTask: (draft, author) => set((s) => {
    if (!draft.titel.trim()) return {};
    // Neue Aufgaben landen unten: höchste vorhandene Position + 1.
    const maxPos = s.tasks.reduce((m, t) => Math.max(m, t.position), -1);
    const task: Task = {
      id: uid(),
      titel: draft.titel.trim(),
      beschreibung: draft.beschreibung?.trim() || undefined,
      status: 'offen',
      erstelltVonId: author.id,
      erstelltVon: author.name,
      // Ohne ausdrückliche Zuweisung gehört die Aufgabe dem Urheber selbst (eigene To-Do-Liste).
      zugewiesenAnId: draft.zugewiesenAnId || author.id,
      zugewiesenAn: draft.zugewiesenAn || author.name,
      faelligkeit: draft.faelligkeit || undefined,
      position: maxPos + 1,
      orderId: draft.orderId || undefined,
      erstelltAm: heute(),
    };
    return { tasks: [...s.tasks, task] };
  }),
  updateTask: (id, patch) => set((s) => ({
    tasks: s.tasks.map((t) => (t.id === id
      ? {
          ...t,
          ...(patch.titel !== undefined ? { titel: patch.titel } : {}),
          ...(patch.beschreibung !== undefined ? { beschreibung: patch.beschreibung || undefined } : {}),
          // faelligkeit gezielt löschbar: leerer String → Datum entfernen (undefined).
          ...(patch.faelligkeit !== undefined ? { faelligkeit: patch.faelligkeit || undefined } : {}),
          ...(patch.orderId !== undefined ? { orderId: patch.orderId || undefined } : {}),
        }
      : t)),
  })),
  assignTask: (id, userId, userName) => set((s) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, zugewiesenAnId: userId, zugewiesenAn: userName } : t)),
  })),
  setTaskStatus: (id, status) => set((s) => ({
    tasks: s.tasks.map((t) => (t.id === id
      ? { ...t, status, erledigtAm: status === 'erledigt' ? heute() : undefined }
      : t)),
  })),
  // Reihenfolge nach Drag & Drop: die gezogenen Aufgaben belegen dieselben Positions-Slots
  // (aufsteigend) in ihrer neuen Reihenfolge — der Rest bleibt unberührt.
  reorderTasks: (orderedIds) => set((s) => {
    const slots = orderedIds
      .map((id) => s.tasks.find((t) => t.id === id)?.position ?? 0)
      .sort((a, b) => a - b);
    const neuePos = new Map(orderedIds.map((id, i) => [id, slots[i]]));
    return { tasks: s.tasks.map((t) => (neuePos.has(t.id) ? { ...t, position: neuePos.get(t.id)! } : t)) };
  }),
  deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  // ---- Stoppuhr ----------------------------------------------------------
  stopwatch: null,
  setStopwatch: (sw) => set({ stopwatch: sw }),
  setStopwatchNotiz: (notiz) => set((s) => (s.stopwatch ? { stopwatch: { ...s.stopwatch, notiz } } : {})),
}), {
  // Klick-Prototyp: Stand im Browser sichern, damit ein Reload nichts verwirft.
  // version bei Änderungen am Mock-Datenmodell erhöhen → alter Stand wird verworfen.
  // Server-Modus: eigener Schlüssel + NUR die noch lokal geführten Teile persistieren —
  // Server-Daten (orders/users) und die Anmeldung kommen beim Start frisch vom Server
  // (Session-Cookie, apiRestore); sonst zeigte ein Reload veraltete Stände.
  name: API_MODE ? 'bk-zeiterfassung-api' : 'bk-zeiterfassung',
  // 14: Checklisten-Punkte tragen eine Herkunft (vorlage/manuell, Review 12.07.) → neu seeden.
  // 15: neues Modul „Aufgaben" (tasks[]) → mitpersistieren, Mock neu seeden.
  // 16: Stoppuhr (stopwatch) → mitpersistieren (läuft über Reload weiter).
  version: 16,
  partialize: (s) => (API_MODE
    ? { besonderheiten: s.besonderheiten, checklistTemplates: s.checklistTemplates, anforderungen: s.anforderungen, tasks: s.tasks, stopwatch: s.stopwatch }
    : { orders: s.orders, users: s.users, besonderheiten: s.besonderheiten, checklistTemplates: s.checklistTemplates, currentUserId: s.currentUserId, anforderungen: s.anforderungen, tasks: s.tasks, stopwatch: s.stopwatch }),
  // Rolle/Admin-Recht werden bewusst NICHT persistiert, sondern beim Laden aus dem angemeldeten
  // Nutzer abgeleitet (eine Quelle der Wahrheit). Ohne dies fiele ein Partner nach Reload auf
  // „mitarbeiter" zurück (Review-Befund 1). Deaktivierte/gelöschte Nutzer werden abgemeldet.
  merge: (persisted, current) => {
    const s = { ...current, ...(persisted as Partial<AppState>) };
    const u = s.users.find((x) => x.id === s.currentUserId);
    if (u?.aktiv) {
      s.role = u.role;
      s.isAdmin = u.admin;
    } else {
      s.currentUserId = null;
      s.role = 'mitarbeiter';
      s.isAdmin = false;
    }
    return s;
  },
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

/** Der aktuell angemeldete Nutzer (Mock-Login) — oder undefined, wenn nicht angemeldet/deaktiviert. */
export function useCurrentUser(): User | undefined {
  return useStore((s) => s.users.find((u) => u.id === s.currentUserId && u.aktiv));
}
