import type { ArtKey } from './types';

/**
 * DATEV-Auftragsartengruppen — Live-Katalog Burchardt & Kollegen (GET /ordertypes, Stand 26.06.2026).
 * Grundlage der Auftragsart-Zuordnung. In M2 wird dieses Mapping pro Kanzlei im Admin-Bereich
 * konfigurierbar (jede Kanzlei hat andere Gruppen) und vom DATEV-Adapter beim Import angewandt.
 */
export interface OrdertypeGroup {
  id: number;
  name: string;
  internal: boolean; // group 9/10 sind komplett isinternal → nicht im Board
  art: ArtKey | null; // null = intern, kein Board-ArtKey
}

export const ORDERTYPE_GROUPS: OrdertypeGroup[] = [
  { id: 1, name: 'Finanzbuchhaltung', internal: false, art: 'fibu' },
  { id: 2, name: 'Lohnbuchführung', internal: false, art: 'lohn' },
  { id: 3, name: 'Jahresabschluss/ betr. Steuern', internal: false, art: 'ja' },
  { id: 4, name: 'Private Steuern', internal: false, art: 'est' },
  { id: 5, name: 'Steuerliche Beratung', internal: false, art: 'beratung' },
  { id: 9, name: 'Verwaltung', internal: true, art: null },
  { id: 10, name: 'Abwesenheit', internal: true, art: null },
  { id: 11, name: 'Wirtschaftliche Beratung', internal: false, art: 'wirtschaft' },
  { id: 12, name: 'Hausverwaltung', internal: false, art: 'hausverwaltung' },
  { id: 13, name: 'Vorbehaltsaufgaben', internal: false, art: 'vorbehalt' },
];

/** Mapping group_id → ArtKey (null = intern). */
export const ORDERTYPE_GROUP_TO_ART: Record<number, ArtKey | null> =
  Object.fromEntries(ORDERTYPE_GROUPS.map((g) => [g.id, g.art]));

/**
 * Ordertypes (Kurz-Code), die als „laufend" gelten (Modul „Laufende Buchungen", nicht im Board) —
 * vom Auftraggeber bestätigt: Mehraufwand FiBu/Lohn + Laufende Steuerberatung. Diese werden aus
 * ihrer Gruppe in einen eigenen „laufend"-Container herausgelöst (per Ordertype, nicht per Gruppe).
 */
export const LAUFENDE_ORDERTYPES: Record<string, ArtKey> = {
  '616': 'mehraufwand', // Mehraufwand FiBu
  '615': 'mehraufwand', // Mehraufwand Lohn
  '601': 'lfd_beratung', // Laufende Steuerberatung
};

/**
 * Leitet den App-ArtKey eines DATEV-Auftrags aus (ordertype-Code, group_id) ab — die Logik, die der
 * DATEV-Adapter in M2 beim Import anwendet. Laufende Ordertypes haben Vorrang vor der Gruppe.
 * Gibt `null` für interne Gruppen (nicht im Board).
 */
export function artKeyForOrdertype(ordertype: string, groupId: number): ArtKey | null {
  return LAUFENDE_ORDERTYPES[ordertype] ?? ORDERTYPE_GROUP_TO_ART[groupId] ?? null;
}
