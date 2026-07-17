/**
 * Schutz gegen wiederholte Login-Fehlversuche (Review 12.07. P3.7, verschaerft 17.07. P2-9):
 * nach `maxVersuche` aufeinanderfolgenden Fehlversuchen wird der Schluessel (Benutzername bzw.
 * Client-IP) fuer `sperreMs` gesperrt; ein erfolgreicher Login setzt den Zaehler zurueck.
 *
 * Konto- und IP-Limit werden GETRENNT dimensioniert (P2-9): der Konto-Schluessel schuetzt das
 * einzelne Konto scharf; der IP-Schluessel bremst Massen-Durchprobieren, muss aber lockerer sein,
 * weil hinter einem Reverse Proxy / NAT viele legitime Nutzer dieselbe IP teilen.
 *
 * Speicher beschraenkt (P2-9): Eintraege haben eine Lebensdauer (`eintragTtlMs`) und werden per
 * Sweep bzw. bei Erreichen von `maxEintraege` (aeltester nicht-gesperrter zuerst) entfernt — die
 * Map kann so nicht unbegrenzt wachsen, wenn viele wechselnde Namen/IPs auftreten.
 *
 * Bewusst In-Memory: das Betriebsmodell ist EINE zentrale Instanz — ein Neustart setzt Zaehler
 * zurueck, was hier akzeptabel ist.
 */

export interface LoginSchutz {
  /** true = aktuell gesperrt (Login gar nicht erst pruefen). */
  gesperrt(key: string): boolean;
  /** Fehlversuch zaehlen; ab maxVersuche beginnt die Sperre. Liefert true, wenn jetzt gesperrt. */
  fehlversuch(key: string): boolean;
  /** Erfolgreicher Login: Zaehler und Sperre fuer den Schluessel loeschen. */
  erfolg(key: string): void;
  /** Aktuelle Anzahl gehaltener Eintraege (fuer Tests/Monitoring). */
  groesse(): number;
}

export interface LoginSchutzOptions {
  /** Aufeinanderfolgende Fehlversuche bis zur Sperre. */
  maxVersuche?: number;
  /** Sperrdauer nach Erreichen der Grenze (ms). */
  sperreMs?: number;
  /** Lebensdauer eines nicht-gesperrten Eintrags ohne neue Aktivitaet (ms) — danach aufgeraeumt. */
  eintragTtlMs?: number;
  /** Obergrenze gehaltener Eintraege; darueber wird der aelteste nicht-gesperrte verworfen. */
  maxEintraege?: number;
  /** Einspeisbare Uhr (Tests). */
  jetzt?: () => number;
}

/** Standardwerte fuer das Konto-Limit (scharf). */
export const LOGIN_SCHUTZ = {
  MAX_VERSUCHE: 5,
  SPERRE_MS: 15 * 60 * 1000,
  EINTRAG_TTL_MS: 60 * 60 * 1000, // 1 h ohne Aktivitaet -> aufgeraeumt
  MAX_EINTRAEGE: 10_000,
} as const;

interface Eintrag {
  fehlversuche: number;
  gesperrtBis: number;
  letzteAktivitaet: number;
}

export function createLoginSchutz(options: LoginSchutzOptions = {}): LoginSchutz {
  const maxVersuche = options.maxVersuche ?? LOGIN_SCHUTZ.MAX_VERSUCHE;
  const sperreMs = options.sperreMs ?? LOGIN_SCHUTZ.SPERRE_MS;
  const eintragTtlMs = options.eintragTtlMs ?? LOGIN_SCHUTZ.EINTRAG_TTL_MS;
  const maxEintraege = options.maxEintraege ?? LOGIN_SCHUTZ.MAX_EINTRAEGE;
  const jetzt = options.jetzt ?? Date.now;
  const eintraege = new Map<string, Eintrag>();

  /** Aufraeumen: abgelaufene Sperren und veraltete, nicht mehr gesperrte Eintraege entfernen. */
  function sweep(): void {
    const now = jetzt();
    for (const [key, e] of eintraege) {
      const gesperrt = e.gesperrtBis > now;
      if (!gesperrt && e.letzteAktivitaet + eintragTtlMs < now) eintraege.delete(key);
    }
  }

  /** Bei voller Map den aeltesten nicht-gesperrten Eintrag verwerfen (Backstop gegen Wachstum). */
  function platzSchaffen(): void {
    if (eintraege.size < maxEintraege) return;
    sweep();
    if (eintraege.size < maxEintraege) return;
    const now = jetzt();
    let aeltester: string | undefined;
    let aeltesteZeit = Infinity;
    for (const [key, e] of eintraege) {
      if (e.gesperrtBis > now) continue; // gesperrte nie verwerfen
      if (e.letzteAktivitaet < aeltesteZeit) {
        aeltesteZeit = e.letzteAktivitaet;
        aeltester = key;
      }
    }
    if (aeltester) eintraege.delete(aeltester);
  }

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
      // Opportunistisch aufraeumen (Login ist selten -> O(n) unkritisch), damit veraltete
      // Eintraege verschwinden, bevor die Map ueberhaupt an die Obergrenze kommt.
      sweep();
      platzSchaffen();
      const now = jetzt();
      const e = eintraege.get(key) ?? { fehlversuche: 0, gesperrtBis: 0, letzteAktivitaet: now };
      e.fehlversuche += 1;
      e.letzteAktivitaet = now;
      if (e.fehlversuche >= maxVersuche) {
        e.gesperrtBis = now + sperreMs;
        e.fehlversuche = 0;
      }
      eintraege.set(key, e);
      return e.gesperrtBis > now;
    },
    erfolg(key) {
      eintraege.delete(key);
    },
    groesse() {
      return eintraege.size;
    },
  };
}
