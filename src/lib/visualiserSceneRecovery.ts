/** Last-known-good scene recovery for the Visualiser sandbox. */
export const LAST_GOOD_KEY = "trade-visualiser-last-good-v1";
export const CRASH_BACKUP_KEY = "trade-visualiser-crash-backup-v1";
export const RECOVERY_KEY = "trade-visualiser-recovery-v1";
/** A scene counts as "working" once it has rendered this long without error. */
export const STABLE_AFTER_MS = 4000;
/** A second crash within this window after a restore falls back to an empty scene. */
export const RECOVERY_LOOP_MS = 30000;

export type RecoveryOutcome = "restored" | "reset";

/**
 * Decide what to write back into the sandbox after a render crash.
 * Returns the JSON to persist (null = clear the scene) and the outcome.
 */
export const planRecovery = (
  lastGood: string | null,
  lastRecoveryAt: number | null,
  now: number,
): { sandbox: string | null; outcome: RecoveryOutcome } => {
  const looping = lastRecoveryAt !== null && now - lastRecoveryAt < RECOVERY_LOOP_MS;
  if (lastGood && !looping) return { sandbox: lastGood, outcome: "restored" };
  return { sandbox: null, outcome: "reset" };
};

export const recoverScene = (storageKey: string, storage: Storage = sessionStorage) => {
  const raw = storage.getItem(RECOVERY_KEY);
  const lastAt = raw ? Number(JSON.parse(raw).at) : null;
  const now = Date.now();
  const plan = planRecovery(storage.getItem(LAST_GOOD_KEY), Number.isFinite(lastAt) ? lastAt : null, now);
  // Never destroy a configuration: keep the crashed scene as a backup and only
  // overwrite it when a known-good snapshot exists.
  const current = storage.getItem(storageKey);
  if (current) storage.setItem(CRASH_BACKUP_KEY, current);
  if (plan.sandbox) storage.setItem(storageKey, plan.sandbox);
  storage.setItem(RECOVERY_KEY, JSON.stringify({ at: now, outcome: plan.outcome, notified: false }));
  return plan.outcome;
};

/** Returns the pending outcome once (for a toast after reload). */
export const takeRecoveryNotice = (storage: Storage = sessionStorage): RecoveryOutcome | null => {
  try {
    const raw = storage.getItem(RECOVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.notified) return null;
    storage.setItem(RECOVERY_KEY, JSON.stringify({ ...parsed, notified: true }));
    return parsed.outcome === "reset" ? "reset" : "restored";
  } catch {
    return null;
  }
};
