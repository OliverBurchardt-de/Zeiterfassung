/**
 * Schutz gegen wiederholte Login-Fehlversuche (Review 12.07.2026, P3.7): nach MAX_VERSUCHE
 * aufeinanderfolgenden Fehlversuchen wird der Schluessel (Benutzername bzw. Client-IP) fuer
 * SPERRE_MS gesperrt; ein erfolgreicher Login setzt den Zaehler zurueck.
 *
 * Bewusst In-Memory: das Betriebsmodell ist EINE zentrale Instanz (verbindliche Entscheidung
 * im Review) — ein Neustart setzt Zaehler zurueck, was hier akzeptabel ist.
 */

export interface LoginSchutz {
  /** true = aktuell gesperrt (Login gar nicht erst pruefen). */
  gesperrt(key: string): boolean;
  /** Fehlversuch zaehlen; ab MAX_VERSUCHE beginnt die Sperre. Liefert true, wenn jetzt gesperrt. */
  fehlversuch(key: string): boolean;
  /** Erfolgreicher Login: Zaehler und Sperre fuer den Schluessel loeschen. */
  erfolg(key: string): void;
}

export const LOGIN_SCHUTZ = {
  /** Aufeinanderfolgende Fehlversuche bis zur Sperre. */
  MAX_VERSUCHE: 5,
  /** Sperrdauer nach Erreichen der Grenze. */
  SPERRE_MS: 15 * 60 * 1000,
} as const;

interface Eintrag {
  fehlversuche: number;
  gesperrtBis: number;
}

export function createLoginSchutz(jetzt: () => number = Date.now): LoginSchutz {
  const eintraege = new Map<string, Eintrag>();

  return {
    gesperrt(key) {
      const e = eintraege.get(key);
      if (!e) return false;
      if (e.gesperrtBis > jetzt()) return true;
      // Abgelaufene Sperre aufraeumen — danach zaehlt ein frisches Fenster.
      if (e.gesperrtBis > 0) eintraege.delete(key);
      return false;
    },
    fehlversuch(key) {
      const e = eintraege.get(key) ?? { fehlversuche: 0, gesperrtBis: 0 };
      e.fehlversuche += 1;
      if (e.fehlversuche >= LOGIN_SCHUTZ.MAX_VERSUCHE) {
        e.gesperrtBis = jetzt() + LOGIN_SCHUTZ.SPERRE_MS;
        e.fehlversuche = 0;
      }
      eintraege.set(key, e);
      return e.gesperrtBis > jetzt();
    },
    erfolg(key) {
      eintraege.delete(key);
    },
  };
}
