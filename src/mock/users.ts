import type { User } from '@/lib/types';

/**
 * Mock-Nutzer für das Modul „Verwaltung". In M2 ersetzt durch die App-DB
 * (eigener Login); die DATEV-Mitarbeiter-ID wird je Nutzer hinterlegt.
 */
export const MOCK_USERS: User[] = [
  {
    id: 'u-ob', name: 'O. Burchardt', initials: 'OB', email: 'oliver.burchardt@burchardt-kollegen.de',
    role: 'partner', admin: true, aktiv: true, datevId: '1001', tagessoll: 8, arbeitstageProWoche: 5,
  },
  {
    id: 'u-sw', name: 'S. Wolf', initials: 'SW', email: 's.wolf@burchardt-kollegen.de',
    role: 'mitarbeiter', admin: false, aktiv: true, datevId: '1012', tagessoll: 8, arbeitstageProWoche: 5,
  },
  {
    // Teilzeit: kürzere Arbeitstage (6 h) an allen 5 Tagen
    id: 'u-mk', name: 'M. Klein', initials: 'MK', email: 'm.klein@burchardt-kollegen.de',
    role: 'mitarbeiter', admin: false, aktiv: true, datevId: '1015', tagessoll: 6, arbeitstageProWoche: 5,
  },
  {
    id: 'u-tb', name: 'T. Berg', initials: 'TB', email: 't.berg@burchardt-kollegen.de',
    role: 'mitarbeiter', admin: false, aktiv: true, datevId: '1021', tagessoll: 8, arbeitstageProWoche: 5,
  },
  {
    // Teilzeit: volle Tage (8 h), aber nur 3 Tage/Woche
    id: 'u-rh', name: 'R. Haas', initials: 'RH', email: 'r.haas@burchardt-kollegen.de',
    role: 'mitarbeiter', admin: false, aktiv: false, datevId: '1008', tagessoll: 8, arbeitstageProWoche: 3,
  },
  {
    // Zweiter Partner OHNE Admin-Recht — macht die Regel „Partner sieht nur seine verantworteten
    // Mandate" in der Demo prüfbar (O. Burchardt sieht als Admin ohnehin alles).
    id: 'u-ap', name: 'A. Peters', initials: 'AP', email: 'a.peters@burchardt-kollegen.de',
    role: 'partner', admin: false, aktiv: true, datevId: '1002', tagessoll: 8, arbeitstageProWoche: 5,
  },
];
