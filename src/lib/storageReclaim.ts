/**
 * Browser storage is capped at ~5 MB per origin. Large cached payloads
 * (mood boards, visualiser state, drafts, catalogue caches) can fill it and
 * then the auth session can no longer be written — sign-in fails with
 * "Setting the value of 'sb-...-auth-token' exceeded the quota".
 *
 * These helpers free room by evicting the largest non-essential entries,
 * never touching the auth session, the basket, or consent records.
 */

const PROTECTED_PREFIXES = ["sb-", "ma_cart", "ma_consent", "cookie_consent", "consent_"];
const PROTECTED_KEYS = new Set([
  "ma_cart_v1",
  "ma_cart_v1_backup",
  "ma_order_placed",
  "ga_optout",
]);

function isProtected(key: string): boolean {
  if (PROTECTED_KEYS.has(key)) return true;
  return PROTECTED_PREFIXES.some((p) => key.startsWith(p));
}

function entriesBySize(): Array<{ key: string; size: number }> {
  const out: Array<{ key: string; size: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || isProtected(key)) continue;
    out.push({ key, size: (localStorage.getItem(key) || "").length });
  }
  return out.sort((a, b) => b.size - a.size);
}

/** Returns true when a payload of `probeBytes` can currently be stored. */
function canStore(probeBytes: number): boolean {
  const probeKey = "__ma_quota_probe__";
  try {
    localStorage.setItem(probeKey, "x".repeat(probeBytes));
    localStorage.removeItem(probeKey);
    return true;
  } catch {
    try { localStorage.removeItem(probeKey); } catch { /* noop */ }
    return false;
  }
}

/**
 * Makes sure roughly `needBytes` of storage headroom exists, evicting the
 * biggest disposable caches first. Safe to call often; does nothing when
 * there is already room.
 */
export function ensureStorageHeadroom(needBytes = 120_000): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (canStore(needBytes)) return true;
    for (const { key } of entriesBySize()) {
      try { localStorage.removeItem(key); } catch { /* noop */ }
      if (canStore(needBytes)) return true;
    }
    return canStore(needBytes);
  } catch {
    return false;
  }
}

/**
 * Global safety net: any write anywhere in the app that would fail because the
 * browser store is full instead frees space and retries once. This makes the
 * "quota exceeded" sign-in failure impossible to reach again, without every
 * call site having to remember to reclaim space first.
 */
let guardInstalled = false;
export function installStorageQuotaGuard(): void {
  if (typeof window === "undefined" || guardInstalled) return;
  guardInstalled = true;
  try {
    const proto = Storage.prototype;
    const original = proto.setItem;
    proto.setItem = function patchedSetItem(this: Storage, key: string, value: string) {
      try {
        return original.call(this, key, value);
      } catch (err) {
        // Only quota failures are recoverable; anything else must surface.
        const name = (err as DOMException)?.name || "";
        const quota = name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
        if (!quota || this !== window.localStorage) throw err;
        ensureStorageHeadroom(Math.max(120_000, (value || "").length * 2));
        return original.call(this, key, value);
      }
    };
  } catch {
    /* storage unavailable (private mode / blocked cookies) — nothing to guard */
  }
}
