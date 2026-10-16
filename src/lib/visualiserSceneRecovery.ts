/** Last-known-good scene recovery for the Visualiser sandbox. */
export const LAST_GOOD_KEY = "trade-visualiser-last-good-v1";
export const CRASH_BACKUP_KEY = "trade-visualiser-crash-backup-v1";
export const RECOVERY_KEY = "trade-visualiser-recovery-v1";
/** A scene counts as "working" once it has rendered this long without error. */
export const STABLE_AFTER_MS = 4000;
/** A second crash within this window must not attempt another automatic restore. */
export const RECOVERY_LOOP_MS = 30000;

export type RecoveryOutcome = "restored" | "reset";

/**
 * Decide what to write back into the sandbox after a render crash.
 * Returns the JSON to persist (null = leave the scene untouched) and the outcome.
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

/** Keep the first populated crash snapshot; later empty/retry scenes cannot erase it. */
export const preserveSceneBackup = (storageKey: string, storage: Storage = sessionStorage) => {
  if (storage.getItem(CRASH_BACKUP_KEY)) return;
  const current = storage.getItem(storageKey);
  if (!current) return;
  const parsed = JSON.parse(current);
  if (Array.isArray(parsed.objects) && parsed.objects.length > 0) storage.setItem(CRASH_BACKUP_KEY, current);
};

export const recoverScene = (storageKey: string, storage: Storage = sessionStorage) => {
  const raw = storage.getItem(RECOVERY_KEY);
  const lastAt = raw ? Number(JSON.parse(raw).at) : null;
  const now = Date.now();
  const plan = planRecovery(storage.getItem(LAST_GOOD_KEY), Number.isFinite(lastAt) ? lastAt : null, now);
  // Never destroy a configuration: keep the crashed scene as a backup and only
  // overwrite it when a known-good snapshot exists.
  preserveSceneBackup(storageKey, storage);
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
