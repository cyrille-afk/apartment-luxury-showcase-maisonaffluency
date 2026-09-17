/**
 * Bespoke specification sync queue.
 *
 * Verified trade members' bespoke submissions are mapped into the persistent
 * workspace deck (localStorage) and replayed into the Felix project log the
 * next time the concierge canvas is opened. A quiet badge on the FELIX header
 * button signals a pending synchronisation.
 *
 * Guest / unverified submissions never touch this queue — they are routed to
 * the concierge inbox only, and Felix must not mount for that session.
 */

export const BESPOKE_SYNC_KEY = "felix:bespoke-sync:v1";
export const BESPOKE_SYNC_EVENT = "felix:bespoke-sync";

export interface BespokeSyncEntry {
  productId?: string;
  productTitle: string;
  designerName?: string | null;
  finishLabel?: string | null;
  specs: string;
  attachmentName?: string | null;
  attachmentPath?: string | null;
  projectLocation?: string | null;
  submittedAt: string;
}

function read(): BespokeSyncEntry[] {
  try {
    const raw = localStorage.getItem(BESPOKE_SYNC_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as BespokeSyncEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: BespokeSyncEntry[]) {
  try {
    localStorage.setItem(BESPOKE_SYNC_KEY, JSON.stringify(entries));
  } catch {
    /* private mode */
  }
  try {
    window.dispatchEvent(new CustomEvent(BESPOKE_SYNC_EVENT, { detail: entries.length }));
  } catch {
    /* SSR */
  }
}

export function pushBespokeSync(entry: BespokeSyncEntry) {
  write([...read(), entry]);
}

export function readPendingBespokeSync(): BespokeSyncEntry[] {
  return read();
}

export function clearBespokeSync() {
  write([]);
}

export function hasPendingBespokeSync(): boolean {
  return read().length > 0;
}

/** Localized confirmation line rendered in the Felix project log timeline. */
export function bespokeSyncConfirmation(entry: BespokeSyncEntry): string {
  const finish = entry.finishLabel?.trim();
  const piece = finish ? `${entry.productTitle} (${finish})` : entry.productTitle;
  const swatch = entry.attachmentName ? "and material swatch files " : "";
  const location = entry.projectLocation?.trim()
    ? ` for the ${entry.projectLocation.trim()} project`
    : "";
  return `I have successfully synchronized your custom specification annotations ${swatch}for the ${piece}${location} into our active layout workspace deck. The atelier team in Paris is currently verifying artisan feasibility. Let's begin defining your project scale guidelines...`;
}
