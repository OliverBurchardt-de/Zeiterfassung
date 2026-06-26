import type { ArtKey } from './types';

/**
 * DATEV-Auftragsarten (Ordertypes) — Live-Katalog Burchardt & Kollegen (GET /ordertypes,
 * Stand 26.06.2026). **Der Ordertype ist die fachliche Identität eines Auftrags** und die einzige
 * Ebene, auf die in DATEV gebucht wird. Die `ordertype_group` ist dagegen nur eine **Klassifizierung**
 * (nicht bebuchbar) — sie dient hier ausschließlich der groben Board-Farbe und einem Sammelfilter.
 *
 * In M2 wird dieser Katalog pro Kanzlei via DATEV-Adapter eingelesen (jede Kanzlei hat andere Arten);
 * die Zuordnung Ordertype → App-Bucket/Workflow ist dann im Admin-Bereich konfigurierbar.
 */

/** Gruppe = reine Klassifizierung (nicht bebuchbar). `art` = grober Farb-/Workflow-Bucket fürs Board. */
export interface OrdertypeGroup {
  id: number;
  name: string;
  internal: boolean; // group 9/10 sind komplett isinternal → nicht im Board
  art: ArtKey | null; // null = intern, kein Board-Bucket
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

/** Mapping group_id → Farb-/Workflow-Bucket (null = intern). */
export const ORDERTYPE_GROUP_TO_ART: Record<number, ArtKey | null> =
  Object.fromEntries(ORDERTYPE_GROUPS.map((g) => [g.id, g.art]));

/**
 * Ein konkreter, bebuchbarer Ordertype (Auftragsart). `ordertype` ist der DATEV-Kurz-Code (auch
 * alphanumerisch). Die Workflow-Flags hängen bewusst am **Ordertype** (nicht an der Gruppe) — in M2
 * pro Kanzlei im Admin-Bereich konfigurierbar.
 */
export interface Ordertype {
  ordertype: string; // Kurz-Code, z. B. '106', 'JAP', 'SAR' (NICHT immer numerisch)
  name: string; // ordertype_name
  groupId: number; // ordertype_group_id (nur Klassifizierung)
  /** Teilauftrags-Rhythmus: eine Suborder je Monat (12) bzw. Quartal (4). Fehlt = keine Teilaufträge. */
  teilauftraege?: 'monat' | 'quartal';
  /** Unterlagen-Prozess: Board-Spalten „Unterlagen angefordert/vollständig" (ua/uv). */
  unterlagen?: boolean;
  /** Mandantenbesonderheiten pflegbar (je Mandant + Ordertype, in Folgeaufträge übernommen). */
  besonderheiten?: boolean;
}

/**
 * Aktive, nicht-interne Ordertypes des Live-Katalogs. Reihenfolge nach Gruppe.
 * (Interne Gruppen 9 Verwaltung / 10 Abwesenheit sind nicht im Board und daher nicht gelistet.)
 */
export const ORDERTYPES: Ordertype[] = [
  // 1 Finanzbuchhaltung
  { ordertype: '101', name: 'Einrichtung Buchführung', groupId: 1 },
  { ordertype: '106', name: 'Monatliche Finanzbuchführung', groupId: 1, teilauftraege: 'monat', besonderheiten: true },
  { ordertype: '107', name: 'Vierteljährliche Buchführung', groupId: 1, teilauftraege: 'quartal', besonderheiten: true },
  { ordertype: '108', name: 'Jahresbuchführung', groupId: 1, besonderheiten: true },
  { ordertype: '310', name: 'Erfolgsreporting', groupId: 1, teilauftraege: 'monat' },
  { ordertype: '320', name: 'Immo-Reporting', groupId: 1, teilauftraege: 'monat' },
  { ordertype: '616', name: 'Mehraufwand FiBu', groupId: 1 },
  // 2 Lohnbuchführung
  { ordertype: '201', name: 'Einrichtung Lohnbuchführung', groupId: 2 },
  { ordertype: '202', name: 'Lohnbuchführung', groupId: 2, teilauftraege: 'monat', besonderheiten: true },
  { ordertype: '615', name: 'Mehraufwand Lohn', groupId: 2 },
  // 3 Jahresabschluss/ betr. Steuern
  { ordertype: '301', name: 'Jahresabschluss/ Betriebliche Steuererklärungen', groupId: 3, unterlagen: true, besonderheiten: true },
  { ordertype: '302', name: 'Einnahmen-Überschussrechnung', groupId: 3, unterlagen: true, besonderheiten: true },
  { ordertype: '303', name: 'Jahresabschluss und betriebliche StE', groupId: 3, unterlagen: true, besonderheiten: true },
  { ordertype: '613', name: 'Prüfung von Steuerbescheiden', groupId: 3 },
  // 4 Private Steuern
  { ordertype: '501', name: 'Einkommensteuererklärung', groupId: 4, besonderheiten: true },
  { ordertype: '502', name: 'Feststellungserklärung', groupId: 4, besonderheiten: true },
  { ordertype: '504', name: 'Erbschaft-/ Schenkungsteuer', groupId: 4 },
  { ordertype: '505', name: 'Einheitsbewertung Grundbesitz', groupId: 4 },
  { ordertype: '507', name: 'Vor- und Nachlauf Private Steuern', groupId: 4 },
  // 5 Steuerliche Beratung
  { ordertype: '601', name: 'Laufende Steuerberatung', groupId: 5 },
  { ordertype: '603', name: 'Anträge', groupId: 5 },
  { ordertype: '605', name: 'Rechtsbehelfe', groupId: 5 },
  { ordertype: '606', name: 'Vermögensstatus/ Bescheinigung', groupId: 5 },
  { ordertype: '607', name: 'Steuerliche Außenprüfung', groupId: 5 },
  { ordertype: '608', name: 'Beratung BUSTRA/ Selbstanzeige', groupId: 5 },
  { ordertype: '609', name: 'Steuerstraf-/Bußgeldverfahren', groupId: 5 },
  { ordertype: '610', name: 'Finanzgerichtliches Verfahren', groupId: 5 },
  { ordertype: '611', name: 'Revisionsverfahren vor dem BFH', groupId: 5 },
  { ordertype: '612', name: 'Beschwerdeverfahren vor dem BFH', groupId: 5 },
  { ordertype: '614', name: 'Begleitung einer Außenprüfung der DRV', groupId: 5 },
  { ordertype: '617', name: 'Begleitung einer Umwandlung nach UmwG und UmwStG', groupId: 5 },
  { ordertype: 'SAR', name: 'Schlussabrechnung Coronahilfen', groupId: 5 },
  // 11 Wirtschaftliche Beratung
  { ordertype: '701', name: 'betriebswirtschaftliche Beratung', groupId: 11 },
  { ordertype: 'Corona', name: 'Corona-Anträge', groupId: 11 },
  { ordertype: 'TRANS', name: 'Eintragung Transparenzregister', groupId: 11 },
  // 12 Hausverwaltung
  { ordertype: '800', name: 'Laufendes Verwalterhonorar', groupId: 12 },
  { ordertype: '802', name: 'Erstellen von NK-Abrechnungen', groupId: 12 },
  // 13 Vorbehaltsaufgaben
  { ordertype: 'FinVermV', name: 'Prüfung nach § 24 FinVermV', groupId: 13 },
  { ordertype: 'JAP', name: 'Jahresabschlussprüfung', groupId: 13 },
  { ordertype: 'MaBV', name: 'Prüfung nach § 16 MaBV', groupId: 13 },
];

/** Schneller Zugriff auf einen Ordertype über seinen Code. */
const ORDERTYPE_BY_CODE: Record<string, Ordertype> =
  Object.fromEntries(ORDERTYPES.map((t) => [t.ordertype, t]));

export function ordertypeInfo(code: string): Ordertype | undefined {
  return ORDERTYPE_BY_CODE[code];
}

/**
 * Ordertypes, die als „laufend" gelten (Modul „Laufende Buchungen", nicht im Board) — vom Auftraggeber
 * bestätigt: Mehraufwand FiBu/Lohn + Laufende Steuerberatung. Ein **Ordertype-genauer Override** der
 * Gruppe — das Musterbeispiel dafür, dass Workflow am Ordertype hängt, nicht an der Gruppe.
 * (800 „Laufendes Verwalterhonorar" ist bewusst NICHT laufend, sondern reguläre Hausverwaltung.)
 */
export const LAUFENDE_ORDERTYPES: Record<string, ArtKey> = {
  '616': 'mehraufwand', // Mehraufwand FiBu
  '615': 'mehraufwand', // Mehraufwand Lohn
  '601': 'lfd_beratung', // Laufende Steuerberatung
};

/**
 * Leitet den App-Bucket (`ArtKey`: Board-Farbe + Default-Workflow) eines Ordertypes ab — die Logik,
 * die der DATEV-Adapter in M2 beim Import anwendet. Laufende Ordertypes haben Vorrang vor der Gruppe.
 * Gibt `null` für interne Gruppen (nicht im Board).
 */
export function artKeyForOrdertype(ordertype: string, groupId: number): ArtKey | null {
  return LAUFENDE_ORDERTYPES[ordertype] ?? ORDERTYPE_GROUP_TO_ART[groupId] ?? null;
}
