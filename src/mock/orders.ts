import type { Order, ArtKey, Employee, Besonderheit, Suborder } from '@/lib/types';
import { checklistFor } from '@/lib/checklists';
import { teilauftragRhythmus } from '@/lib/art';
import { artKeyForOrdertype, ordertypeInfo } from '@/lib/ordertypes';
import { monthRange, monatBounds } from '@/lib/monate';

/**
 * Seed-Auftrag: trägt nur den `ordertype` (= DATEV-Identität); `art` (Name) und `artKey` (Bucket)
 * werden daraus projiziert — genau das, was der DATEV-Adapter beim Import macht.
 */
type OrderSeed = Omit<Order, 'art' | 'artKey'>;

/**
 * Teilaufträge eines Jahres je Rhythmus: 12 Monate (`monat`) bzw. 4 Quartale (`quartal`).
 * `erledigt` Perioden gelten als fertig, die Folgeperiode als angefangen (40 %).
 */
function periodSuborders(
  year: number,
  rhythmus: 'monat' | 'quartal',
  sollProPeriode: number,
  erledigt: number,
): Suborder[] {
  const angefangen = Math.round(sollProPeriode * 0.4 * 10) / 10;
  const erfasstFor = (i: number) => (i < erledigt ? sollProPeriode : i === erledigt ? angefangen : 0);

  if (rhythmus === 'quartal') {
    return [0, 1, 2, 3].map((q) => {
      const endMonat = q * 3 + 2; // 0-basiert: Mär/Jun/Sep/Dez
      const letzterTag = new Date(year, endMonat + 1, 0);
      return {
        id: `sb-${year}-q${q + 1}`,
        monat: `Q${q + 1} ${year}`,
        soll: sollProPeriode,
        erfasst: erfasstFor(q),
        erledigtAm: q < erledigt
          ? `${year}-${String(endMonat + 1).padStart(2, '0')}-${String(letzterTag.getDate()).padStart(2, '0')}`
          : undefined,
      };
    });
  }
  return monthRange(year, 0, 12).map((monat, i) => ({
    id: `sb-${year}-${i}`,
    monat,
    soll: sollProPeriode,
    erfasst: erfasstFor(i),
    erledigtAm: i < erledigt ? monatBounds(monat)?.end : undefined,
  }));
}

export const EMPLOYEES: Employee[] = [
  { id: 'sw', name: 'S. Wolf', initials: 'SW' },
  { id: 'mk', name: 'M. Klein', initials: 'MK' },
  { id: 'tb', name: 'T. Berg', initials: 'TB' },
];

export const CURRENT_USER: Employee = EMPLOYEES[0];

/**
 * Demo-Stichtag für Auswertungen (Controlling: „überfällig"). Die Mock-Aufträge liegen rund um
 * den März 2025; in Produktion wird hier das echte Tagesdatum verwendet.
 */
export const HEUTE = '2025-03-20';

/**
 * Demo-Kalenderhorizont: ab Jahresbeginn von HEUTE, 15 Monate. Einzige Quelle für die
 * planbaren/umplanbaren Monate — Planung (Kalender) und Umplanung (Detail) nutzen sie gemeinsam,
 * statt das Jahr je Stelle zu hardcoden. In Produktion aus echtem Datum bzw. DATEV-Kapazität.
 */
export const DEMO_KALENDER = monthRange(Number(HEUTE.slice(0, 4)), 0, 15);

let seq = 1100;
const nextNr = () => `A-2025-${++seq}`;

const BASE_ORDERS: OrderSeed[] = [
  {
    // ua/uv sind den Ordertypes mit Unterlagen-Prozess vorbehalten (JA 301/302/303) —
    // die Demo-Belegung der beiden Spalten kommt daher von JA-Aufträgen (o1/o2).
    id: 'o1', mandant: 'Praxis Dr. Wagner', mandantNr: 'D10217', auftragsNr: nextNr(),
    ordertype: '303', vj: 2024,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 18, seiten: 42, kosten: 1840, status: 'ua',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o2', mandant: 'Müller Immobilien GmbH', mandantNr: 'D10219', auftragsNr: nextNr(),
    ordertype: '303', vj: 2024,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 24, seiten: 0, kosten: 0, status: 'uv',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
    umplanung: { zielMonat: 'Apr 2025', freigabeAusstehend: true },
  },
  {
    id: 'o3', mandant: 'TechStart UG', mandantNr: 'D10221', auftragsNr: nextNr(),
    ordertype: '106', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 10, seiten: 12, kosten: 620, status: 'bb',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o4', mandant: 'Hotel Seeblick KG', mandantNr: 'D10224', auftragsNr: nextNr(),
    ordertype: '106', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 8, seiten: 6, kosten: 410, status: 'av',
    bearbeiter: 'M. Klein', bearbeiterId: 'mk', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o5', mandant: 'Bäckerei Lindner', mandantNr: 'D10216', auftragsNr: nextNr(),
    ordertype: '303', vj: 2023,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Jan 2025',
    soll: 16, seiten: 22, kosten: 1320, status: 'bb',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [],
    notes: [],
    times: [{ id: 't1', datum: '2025-03-18', dauer: 3.5, status: 'erfasst' }],
    // Laufender Demo-Timer: MIT Startzeitpunkt seeden (~12 min her), sonst friert der
    // zeitstempelbasierte Timer bei 00:00 ein und „Übertragen" bucht nichts (Codex-Review P3).
    timerRunning: true, timerSec: 0, timerStartedAt: Date.now() - 12 * 60 * 1000,
  },
  {
    id: 'o6', mandant: 'Schmidt & Partner', mandantNr: 'D10230', auftragsNr: nextNr(),
    ordertype: '701', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-10', monat: 'Mär 2025',
    soll: 3, seiten: 2, kosten: 180, status: 'bb',
    bearbeiter: 'T. Berg', bearbeiterId: 'tb', partner: 'A. Peters',
    checklist: [], notes: [],
    times: [{ id: 't2', datum: '2025-03-17', dauer: 4.0, status: 'erfasst' }],
  },
  {
    id: 'o7', mandant: 'Gärtnerei Blum', mandantNr: 'D10233', auftragsNr: nextNr(),
    ordertype: '501', vj: 2024,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 6, seiten: 14, kosten: 540, status: 'rf',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't3', datum: '2025-03-15', dauer: 5.5, status: 'freigegeben' }],
  },
  {
    id: 'o8', mandant: 'Bäckerei Lindner', mandantNr: 'D10216', auftragsNr: nextNr(),
    ordertype: '303', vj: 2023,
    fristStart: '2025-01-01', fristEnde: '2025-01-31', monat: 'Jan 2025',
    soll: 16, seiten: 30, kosten: 980, status: 'rn',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [],
    notes: [
      {
        id: 'n1', kind: 'review', noteState: 'offen', author: 'O. Burchardt',
        text: 'Abschreibung Anlage Nr. 1240 prüfen — Nutzungsdauer korrekt?',
        comments: [],
        attachments: [
          {
            id: 'a1', name: 'Anlagenverzeichnis_1240.txt', size: 48213,
            url: 'data:text/plain;charset=utf-8,Beispielhafter%20Anhang%20zur%20Review-Note%20(Mock-Daten).',
          },
        ],
      },
      {
        id: 'n2', kind: 'review', noteState: 'erledigt', author: 'O. Burchardt',
        text: 'Rückstellung Steuerberatungskosten zu niedrig angesetzt.',
        comments: [
          { id: 'c1', author: 'S. Wolf', role: 'mitarbeiter', text: 'Rückstellung auf 2.400 € angepasst, Beleg im DMS hinterlegt.' },
        ],
        attachments: [],
      },
      {
        id: 'n3', kind: 'frage', noteState: 'erledigt', author: 'S. Wolf',
        text: 'Privatanteil Kfz mit 1%-Regelung korrekt?',
        comments: [
          { id: 'c2', author: 'O. Burchardt', role: 'partner', text: 'Ja, 1%-Regelung passt.' },
        ],
        attachments: [],
      },
    ],
    times: [{ id: 't4', datum: '2025-03-14', dauer: 3.5, status: 'freigegeben' }],
  },
  {
    id: 'o9', mandant: 'Autohaus Reuter', mandantNr: 'D10240', auftragsNr: nextNr(),
    ordertype: '202', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-05', monat: 'Mär 2025',
    soll: 4, seiten: 8, kosten: 320, status: 'fg',
    bearbeiter: 'M. Klein', bearbeiterId: 'mk', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't5', datum: '2025-03-04', dauer: 4.0, status: 'freigegeben' }],
  },
  {
    id: 'o10', mandant: 'Café Central', mandantNr: 'D10244', auftragsNr: nextNr(),
    ordertype: '802', vj: 2025,
    fristStart: '2025-02-01', fristEnde: '2025-02-10', monat: 'Feb 2025',
    soll: 2, seiten: 2, kosten: 120, status: 'am',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't6', datum: '2025-02-08', dauer: 2.0, status: 'freigegeben' }],
  },
  {
    id: 'o11', mandant: 'Zahnarztpraxis Dr. Vogel', mandantNr: 'D10248', auftragsNr: nextNr(),
    ordertype: '501', vj: 2023,
    fristStart: '2025-02-01', fristEnde: '2025-02-28', monat: 'Feb 2025',
    soll: 5, seiten: 16, kosten: 600, status: 'fa',
    bearbeiter: 'T. Berg', bearbeiterId: 'tb', partner: 'A. Peters',
    checklist: [], notes: [],
    times: [{ id: 't7', datum: '2025-02-20', dauer: 5.0, status: 'freigegeben' }],
  },
  {
    id: 'o12', mandant: 'Maler Brandt GmbH', mandantNr: 'D10250', auftragsNr: nextNr(),
    ordertype: '303', vj: 2023,
    fristStart: '2025-01-01', fristEnde: '2025-01-31', monat: 'Jan 2025',
    soll: 20, seiten: 38, kosten: 1620, status: 'er', fakturiert: true,
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't8', datum: '2025-01-28', dauer: 19.5, status: 'freigegeben' }],
  },
  {
    id: 'o13', mandant: 'Fahrschule Konrad', mandantNr: 'D10255', auftragsNr: nextNr(),
    ordertype: '202', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-05', monat: 'Mär 2025',
    soll: 3, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'M. Klein', bearbeiterId: 'mk', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o14', mandant: 'Weingut Stein', mandantNr: 'D10260', auftragsNr: nextNr(),
    ordertype: '107', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 9, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o15', mandant: 'IT-Systeme Faber', mandantNr: 'D10262', auftragsNr: nextNr(),
    ordertype: 'JAP', vj: 2024,
    fristStart: '2025-03-01', fristEnde: '2025-03-10', monat: 'Mär 2025',
    soll: 2, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'T. Berg', bearbeiterId: 'tb', partner: 'A. Peters',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o16', mandant: 'Spedition Krämer', mandantNr: 'D10266', auftragsNr: nextNr(),
    ordertype: '607', vj: 2024,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 22, seiten: 4, kosten: 240, status: 'bb',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o17', mandant: 'Praxis Dr. Wagner', mandantNr: 'D10217', auftragsNr: nextNr(),
    ordertype: '601', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 0, seiten: 0, kosten: 0, status: 'bb',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't17', datum: '2025-03-12', dauer: 0.75, status: 'erfasst', notiz: 'Telefonische Beratung zur geplanten Anschaffung (Investitionsabzugsbetrag).' }],
  },
  {
    id: 'o18', mandant: 'Hotel Seeblick KG', mandantNr: 'D10224', auftragsNr: nextNr(),
    ordertype: '616', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 0, seiten: 0, kosten: 0, status: 'bb',
    bearbeiter: 'M. Klein', bearbeiterId: 'mk', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't18', datum: '2025-03-13', dauer: 1.25, status: 'erfasst', aufwandsart: 'dumm', notiz: 'Nacherfassung fehlender Belege – durch Mandant verursacht.' }],
  },
  {
    id: 'o19', mandant: 'Hotel Seeblick KG', mandantNr: 'D10224', auftragsNr: nextNr(),
    ordertype: '601', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 0, seiten: 0, kosten: 0, status: 'bb',
    bearbeiter: 'M. Klein', bearbeiterId: 'mk', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },

  // --- Noch nicht geplante Aufträge (Pool fürs Planungs-Modul: ohne Monat/Datum) ---
  {
    id: 'p1', mandant: 'Bauunternehmen Vogt', mandantNr: 'D10270', auftragsNr: nextNr(),
    ordertype: '303', vj: 2025,
    fristStart: '', fristEnde: '', monat: '',
    soll: 20, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'p2', mandant: 'Apotheke am Markt', mandantNr: 'D10272', auftragsNr: nextNr(),
    ordertype: '501', vj: 2025,
    fristStart: '', fristEnde: '', monat: '',
    soll: 6, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'p3', mandant: 'Stadtwerke Beteiligung', mandantNr: 'D10275', auftragsNr: nextNr(),
    ordertype: '303', vj: 2025,
    fristStart: '', fristEnde: '', monat: '',
    soll: 24, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'p4', mandant: 'Logistik Nord GmbH', mandantNr: 'D10278', auftragsNr: nextNr(),
    ordertype: '303', vj: 2025,
    fristStart: '', fristEnde: '', monat: '',
    soll: 16, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'M. Klein', bearbeiterId: 'mk', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'p5', mandant: 'Praxis Dr. Sommer', mandantNr: 'D10281', auftragsNr: nextNr(),
    ordertype: '501', vj: 2024,
    fristStart: '', fristEnde: '', monat: '',
    soll: 5, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'T. Berg', bearbeiterId: 'tb', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
];

/**
 * Checkliste je Auftrag aus der Auftragsart-Vorlage seeden (sofern nicht explizit gesetzt);
 * FiBu/Lohn zusätzlich mit 12 Monats-Teilaufträgen (2 Monate erledigt — Demo zum Stichtag März).
 */
export const MOCK_ORDERS: Order[] = BASE_ORDERS.map((o) => {
  const info = ordertypeInfo(o.ordertype);
  // artKey = Bucket aus dem Ordertype ableiten (wie der DATEV-Adapter beim Import); Fallback nur defensiv.
  const artKey: ArtKey = artKeyForOrdertype(o.ordertype, info?.groupId ?? 0) ?? 'beratung';
  const rhythmus = teilauftragRhythmus(o.ordertype);
  return {
    ...o,
    art: info?.name ?? o.ordertype,
    artKey,
    checklist: o.checklist.length ? o.checklist : checklistFor(artKey),
    suborders: rhythmus
      ? periodSuborders(o.vj, rhythmus, o.soll, rhythmus === 'quartal' ? 1 : 2)
      : undefined,
  };
});

/**
 * Mandantenbesonderheiten — Schlüssel = `${mandantNr}::${ordertype}` (period-unabhängig,
 * deckungsgleich mit DB-Design `clientId+ordertype`).
 * Bäckerei Lindner (D10216) hat zwei 303-Aufträge (o5, o8) → beide greifen auf denselben Eintrag zu;
 * genauso würde der JA-Folgeauftrag eines neuen Jahres automatisch dieselben Besonderheiten zeigen.
 */
export const MOCK_BESONDERHEITEN: Record<string, Besonderheit[]> = {
  'D10216::303': [
    { id: 'b1', text: 'Vorräte werden nach FIFO bewertet (Abstimmung mit Mandant 2022).', author: 'O. Burchardt', datum: '2024-02-10' },
    { id: 'b2', text: 'Pensionsrückstellung: jährliches versicherungsmathematisches Gutachten anfordern.', author: 'S. Wolf', datum: '2024-02-12' },
  ],
  'D10221::106': [
    { id: 'b3', text: 'EU-Eingangsleistungen: Reverse-Charge beachten (§ 13b UStG).', author: 'S. Wolf', datum: '2025-01-15' },
    { id: 'b4', text: 'Buchung auf Kostenstellen je Projekt erforderlich.', author: 'S. Wolf', datum: '2025-01-15' },
  ],
};
