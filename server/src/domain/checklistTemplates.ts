/**
 * Default-Checklisten-Vorlagen je Ordertype — die serverseitige Rueckfall-Quelle fuer das
 * „Erledigt"-Gate. Ohne sie waere das Gate umgehbar: die Checkliste wird sonst erst beim ersten
 * Oeffnen des Auftrags-Details instanziiert (checklist.ensure), und eine LEERE Checkliste gilt
 * als vollstaendig — ein Board-Drag auf „Erledigt" vor dem ersten Oeffnen liefe am Gate vorbei
 * (Codex-Review P2). Die Status-Aktion seedet deshalb bei Bedarf selbst aus dieser Vorlage.
 *
 * BEWUSSTE DUPLIKATION (Interim): Spiegel der Frontend-Defaults in `src/lib/checklists.ts`
 * (CHECKLIST_TEMPLATES je Bucket, projiziert auf die Ordertypes der Gruppen 1 FiBu und 3 JA;
 * 616 „Mehraufwand FiBu" ist per Override kein FiBu-Bucket und hat daher keine Vorlage).
 * Abgeloest wird das durch server-seitig verwaltete Vorlagen (Etappe-3-Folgeschritt) — bis dahin
 * greifen admin-editierte Vorlagen weiterhin ueber das Frontend-`ensure` beim ersten Oeffnen;
 * hier stehen nur die unveraenderten Defaults als verbindliche Untergrenze.
 */

const FIBU_LABELS = ['Personalaufwand abgestimmt', 'USt gebucht', 'AfA gebucht', 'BWA übermittelt'];
const JA_LABELS = ['Summen- & Saldenliste geprüft', 'Kontennachweise vollständig', 'Anlagenverzeichnis abgestimmt'];

/** Ordertypes der Gruppe 1 (FiBu) ohne 616 bzw. Gruppe 3 (JA) — siehe src/lib/ordertypes.ts. */
const TEMPLATES_BY_ORDERTYPE: Record<string, string[]> = {
  '101': FIBU_LABELS, '106': FIBU_LABELS, '107': FIBU_LABELS, '108': FIBU_LABELS,
  '310': FIBU_LABELS, '320': FIBU_LABELS,
  '301': JA_LABELS, '302': JA_LABELS, '303': JA_LABELS, '613': JA_LABELS,
};

/** Default-Vorlage eines Ordertypes (leer = keine Pflicht-Checkliste). */
export function defaultChecklistLabels(ordertype: string): string[] {
  return TEMPLATES_BY_ORDERTYPE[ordertype] ?? [];
}
