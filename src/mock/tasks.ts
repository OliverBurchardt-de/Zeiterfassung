import type { Task } from '@/lib/types';

/**
 * Demo-Aufgaben (Modul „Aufgaben"). Datumsbezug: Demo-Stichtag HEUTE = 2025-03-20
 * (src/mock/orders.ts) — daher liegen die Fristen bewusst davor/darauf/danach, damit
 * „überfällig / heute / demnächst" in der Ansicht sichtbar werden. In M2 aus der App-DB.
 *
 * Nutzer-IDs siehe src/mock/users.ts: u-ob (O. Burchardt), u-sw (S. Wolf), u-mk (M. Klein),
 * u-tb (T. Berg), u-bo (B. Ostermann). Auftrags-IDs o1..o6 (src/mock/orders.ts).
 */
export const MOCK_TASKS: Task[] = [
  {
    id: 't1', titel: 'Belege Praxis Dr. Wagner nachfordern', status: 'offen',
    erstelltVonId: 'u-ob', erstelltVon: 'O. Burchardt',
    zugewiesenAnId: 'u-sw', zugewiesenAn: 'S. Wolf',
    faelligkeit: '2025-03-18', position: 0, orderId: 'o1',
    erstelltAm: '2025-03-12',
    beschreibung: 'Kontoauszüge Februar fehlen noch — bitte beim Mandanten anfordern.',
  },
  {
    id: 't2', titel: 'Rückruf Steuerberaterkammer', status: 'offen',
    erstelltVonId: 'u-sw', erstelltVon: 'S. Wolf',
    zugewiesenAnId: 'u-sw', zugewiesenAn: 'S. Wolf',
    faelligkeit: '2025-03-20', position: 1,
    erstelltAm: '2025-03-19',
  },
  {
    id: 't3', titel: 'Umsatzsteuer-Voranmeldung TechStart prüfen', status: 'offen',
    erstelltVonId: 'u-mk', erstelltVon: 'M. Klein',
    zugewiesenAnId: 'u-sw', zugewiesenAn: 'S. Wolf',
    faelligkeit: '2025-03-26', position: 2, orderId: 'o3',
    erstelltAm: '2025-03-17',
    beschreibung: 'Vor Freigabe bitte die Reverse-Charge-Fälle gegenprüfen.',
  },
  {
    id: 't4', titel: 'Frage zur Abschreibung Hotel Seeblick klären', status: 'offen',
    erstelltVonId: 'u-sw', erstelltVon: 'S. Wolf',
    zugewiesenAnId: 'u-ob', zugewiesenAn: 'O. Burchardt',
    faelligkeit: '2025-03-24', position: 3, orderId: 'o4',
    erstelltAm: '2025-03-18',
  },
  {
    id: 't5', titel: 'Mandantenstammdaten Müller Immobilien aktualisieren', status: 'offen',
    erstelltVonId: 'u-ob', erstelltVon: 'O. Burchardt',
    zugewiesenAnId: 'u-mk', zugewiesenAn: 'M. Klein',
    position: 4, orderId: 'o2',
    erstelltAm: '2025-03-15',
  },
  {
    id: 't6', titel: 'Ablage Jahresordner 2024 vorbereiten', status: 'offen',
    erstelltVonId: 'u-ob', erstelltVon: 'O. Burchardt',
    zugewiesenAnId: 'u-tb', zugewiesenAn: 'T. Berg',
    faelligkeit: '2025-04-02', position: 5,
    erstelltAm: '2025-03-16',
  },
  {
    id: 't7', titel: 'Eingangspost sortiert', status: 'erledigt',
    erstelltVonId: 'u-ob', erstelltVon: 'O. Burchardt',
    zugewiesenAnId: 'u-sw', zugewiesenAn: 'S. Wolf',
    faelligkeit: '2025-03-17', position: 6,
    erstelltAm: '2025-03-14', erledigtAm: '2025-03-17',
  },
];
