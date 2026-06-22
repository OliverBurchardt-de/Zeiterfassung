import type { Order, Employee, Besonderheit } from '@/lib/types';
import { checklistFor } from '@/lib/checklists';

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

let seq = 1100;
const nextNr = () => `A-2025-${++seq}`;

const BASE_ORDERS: Order[] = [
  {
    id: 'o1', mandant: 'Praxis Dr. Wagner', mandantNr: 'D10217', auftragsNr: nextNr(),
    art: 'Jahresabschluss', artKey: 'ja', vj: 2024,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 18, seiten: 42, kosten: 1840, status: 'av',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o2', mandant: 'Müller Immobilien GmbH', mandantNr: 'D10219', auftragsNr: nextNr(),
    art: 'Jahresabschluss', artKey: 'ja', vj: 2024,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 24, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
    umplanung: { zielMonat: 'Apr 2025', freigabeAusstehend: true },
  },
  {
    id: 'o3', mandant: 'TechStart UG', mandantNr: 'D10221', auftragsNr: nextNr(),
    art: 'Finanzbuchhaltung', artKey: 'fibu', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 10, seiten: 12, kosten: 620, status: 'ua',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o4', mandant: 'Hotel Seeblick KG', mandantNr: 'D10224', auftragsNr: nextNr(),
    art: 'Finanzbuchhaltung', artKey: 'fibu', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 8, seiten: 6, kosten: 410, status: 'uv',
    bearbeiter: 'M. Klein', bearbeiterId: 'mk', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o5', mandant: 'Bäckerei Lindner', mandantNr: 'D10216', auftragsNr: nextNr(),
    art: 'Jahresabschluss', artKey: 'ja', vj: 2023,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Jan 2025',
    soll: 16, seiten: 22, kosten: 1320, status: 'bb',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [],
    notes: [],
    times: [{ id: 't1', datum: '2025-03-18', dauer: 3.5, freigegeben: false }],
    timerRunning: true, timerSec: 0,
  },
  {
    id: 'o6', mandant: 'Schmidt & Partner', mandantNr: 'D10230', auftragsNr: nextNr(),
    art: 'Umsatzsteuer-Voranmeldung', artKey: 'ust', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-10', monat: 'Mär 2025',
    soll: 3, seiten: 2, kosten: 180, status: 'bb',
    bearbeiter: 'T. Berg', bearbeiterId: 'tb', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't2', datum: '2025-03-17', dauer: 4.0, freigegeben: false }],
  },
  {
    id: 'o7', mandant: 'Gärtnerei Blum', mandantNr: 'D10233', auftragsNr: nextNr(),
    art: 'Einkommensteuer', artKey: 'est', vj: 2024,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 6, seiten: 14, kosten: 540, status: 'rf',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't3', datum: '2025-03-15', dauer: 5.5, freigegeben: true }],
  },
  {
    id: 'o8', mandant: 'Bäckerei Lindner', mandantNr: 'D10216', auftragsNr: nextNr(),
    art: 'Jahresabschluss', artKey: 'ja', vj: 2023,
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
    times: [{ id: 't4', datum: '2025-03-14', dauer: 3.5, freigegeben: true }],
  },
  {
    id: 'o9', mandant: 'Autohaus Reuter', mandantNr: 'D10240', auftragsNr: nextNr(),
    art: 'Lohnbuchhaltung', artKey: 'lohn', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-05', monat: 'Mär 2025',
    soll: 4, seiten: 8, kosten: 320, status: 'fg',
    bearbeiter: 'M. Klein', bearbeiterId: 'mk', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't5', datum: '2025-03-04', dauer: 4.0, freigegeben: true }],
  },
  {
    id: 'o10', mandant: 'Café Central', mandantNr: 'D10244', auftragsNr: nextNr(),
    art: 'Umsatzsteuer-Voranmeldung', artKey: 'ust', vj: 2025,
    fristStart: '2025-02-01', fristEnde: '2025-02-10', monat: 'Feb 2025',
    soll: 2, seiten: 2, kosten: 120, status: 'am',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't6', datum: '2025-02-08', dauer: 2.0, freigegeben: true }],
  },
  {
    id: 'o11', mandant: 'Zahnarztpraxis Dr. Vogel', mandantNr: 'D10248', auftragsNr: nextNr(),
    art: 'Einkommensteuer', artKey: 'est', vj: 2023,
    fristStart: '2025-02-01', fristEnde: '2025-02-28', monat: 'Feb 2025',
    soll: 5, seiten: 16, kosten: 600, status: 'fa',
    bearbeiter: 'T. Berg', bearbeiterId: 'tb', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't7', datum: '2025-02-20', dauer: 5.0, freigegeben: true }],
  },
  {
    id: 'o12', mandant: 'Maler Brandt GmbH', mandantNr: 'D10250', auftragsNr: nextNr(),
    art: 'Jahresabschluss', artKey: 'ja', vj: 2023,
    fristStart: '2025-01-01', fristEnde: '2025-01-31', monat: 'Jan 2025',
    soll: 20, seiten: 38, kosten: 1620, status: 'er', abgerechnet: true,
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't8', datum: '2025-01-28', dauer: 19.5, freigegeben: true }],
  },
  {
    id: 'o13', mandant: 'Fahrschule Konrad', mandantNr: 'D10255', auftragsNr: nextNr(),
    art: 'Lohnbuchhaltung', artKey: 'lohn', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-05', monat: 'Mär 2025',
    soll: 3, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'M. Klein', bearbeiterId: 'mk', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o14', mandant: 'Weingut Stein', mandantNr: 'D10260', auftragsNr: nextNr(),
    art: 'Finanzbuchhaltung', artKey: 'fibu', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 9, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o15', mandant: 'IT-Systeme Faber', mandantNr: 'D10262', auftragsNr: nextNr(),
    art: 'Umsatzsteuer-Voranmeldung', artKey: 'ust', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-10', monat: 'Mär 2025',
    soll: 2, seiten: 0, kosten: 0, status: 'av',
    bearbeiter: 'T. Berg', bearbeiterId: 'tb', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o16', mandant: 'Spedition Krämer', mandantNr: 'D10266', auftragsNr: nextNr(),
    art: 'Jahresabschluss', artKey: 'ja', vj: 2024,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 22, seiten: 4, kosten: 240, status: 'uv',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [], times: [],
  },
  {
    id: 'o17', mandant: 'Praxis Dr. Wagner', mandantNr: 'D10217', auftragsNr: nextNr(),
    art: 'Laufende Steuerberatung', artKey: 'beratung', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 0, seiten: 0, kosten: 0, status: 'bb',
    bearbeiter: 'S. Wolf', bearbeiterId: 'sw', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't17', datum: '2025-03-12', dauer: 0.75, freigegeben: false, notiz: 'Telefonische Beratung zur geplanten Anschaffung (Investitionsabzugsbetrag).' }],
  },
  {
    id: 'o18', mandant: 'Hotel Seeblick KG', mandantNr: 'D10224', auftragsNr: nextNr(),
    art: 'Mehraufwand / Dumm gelaufen', artKey: 'mehraufwand', vj: 2025,
    fristStart: '2025-03-01', fristEnde: '2025-03-31', monat: 'Mär 2025',
    soll: 0, seiten: 0, kosten: 0, status: 'bb',
    bearbeiter: 'M. Klein', bearbeiterId: 'mk', partner: 'O. Burchardt',
    checklist: [], notes: [],
    times: [{ id: 't18', datum: '2025-03-13', dauer: 1.25, freigegeben: false, notiz: 'Nacherfassung fehlender Belege – durch Mandant verursacht.' }],
  },
];

/** Checkliste je Auftrag aus der Auftragsart-Vorlage seeden (sofern nicht explizit gesetzt). */
export const MOCK_ORDERS: Order[] = BASE_ORDERS.map((o) => ({
  ...o,
  checklist: o.checklist.length ? o.checklist : checklistFor(o.artKey),
}));

/**
 * Mandantenbesonderheiten — Schlüssel = `${mandantNr}::${artKey}` (period-unabhängig).
 * Bäckerei Lindner (D10216) hat zwei JA-Aufträge (o5, o8) → beide greifen auf denselben Eintrag zu;
 * genauso würde der JA-Folgeauftrag eines neuen Jahres automatisch dieselben Besonderheiten zeigen.
 */
export const MOCK_BESONDERHEITEN: Record<string, Besonderheit[]> = {
  'D10216::ja': [
    { id: 'b1', text: 'Vorräte werden nach FIFO bewertet (Abstimmung mit Mandant 2022).', author: 'O. Burchardt', datum: '2024-02-10' },
    { id: 'b2', text: 'Pensionsrückstellung: jährliches versicherungsmathematisches Gutachten anfordern.', author: 'S. Wolf', datum: '2024-02-12' },
  ],
  'D10221::fibu': [
    { id: 'b3', text: 'EU-Eingangsleistungen: Reverse-Charge beachten (§ 13b UStG).', author: 'S. Wolf', datum: '2025-01-15' },
    { id: 'b4', text: 'Buchung auf Kostenstellen je Projekt erforderlich.', author: 'S. Wolf', datum: '2025-01-15' },
  ],
};
