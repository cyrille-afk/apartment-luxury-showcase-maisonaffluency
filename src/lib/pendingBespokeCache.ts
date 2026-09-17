/**
 * Pending bespoke upload cache.
 *
 * A public guest who submits a bespoke specification and then enters the Trade
 * Program application / onboarding loop must NOT have that payload pushed into
 * the Felix chat history on mount. The specs, swatch files and target product
 * tokens are parked here (session scoped) and only merged into the project log
 * once the platform tour has fully concluded.
 */

export const PENDING_BESPOKE_CACHE_KEY = "felix:pending-bespoke-upload:v1";

export interface PendingBespokeUploadEntry {
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

function read(): PendingBespokeUploadEntry[] {
  try {
    const raw = sessionStorage.getItem(PENDING_BESPOKE_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingBespokeUploadEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: PendingBespokeUploadEntry[]) {
  try {
    sessionStorage.setItem(PENDING_BESPOKE_CACHE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable */
  }
}

export function cachePendingBespokeUpload(entry: PendingBespokeUploadEntry) {
  write([...read(), entry]);
}

export function readPendingBespokeUploadCache(): PendingBespokeUploadEntry[] {
  return read();
}

export function clearPendingBespokeUploadCache() {
  try {
    sessionStorage.removeItem(PENDING_BESPOKE_CACHE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function hasPendingBespokeUploadCache(): boolean {
  return read().length > 0;
}

/** Introduction bubble rendered directly beneath the standard welcome paragraph. */
export function pendingBespokeIntro(entry: PendingBespokeUploadEntry): string {
  const finish = entry.finishLabel ? ` (${entry.finishLabel})` : "";
  const files = entry.attachmentName ? "annotations and material swatch files" : "annotations";
  return `Welcome to your synchronized studio workspace. I have successfully pulled your pending custom specification ${files} for the ${entry.productTitle}${finish} into our active session layout deck. Let's begin defining your project boundaries.`;
}
