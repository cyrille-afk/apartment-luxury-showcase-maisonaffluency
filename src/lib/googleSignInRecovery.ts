export const GOOGLE_ATTEMPT_KEY = "maison:google-sign-in-attempt";
const ATTEMPT_MAX_AGE = 30 * 60 * 1000;

export function safeGoogleReturnPath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !path.startsWith("/trade/login") ? path : "/trade";
}

export function readGoogleAttempt(storage: Pick<Storage, "getItem">, now = Date.now()): string | null {
  try {
    const raw = storage.getItem(GOOGLE_ATTEMPT_KEY);
    if (!raw) return null;
    const attempt = JSON.parse(raw);
    if (typeof attempt.startedAt !== "number" || typeof attempt.next !== "string") return null;
    const age = now - attempt.startedAt;
    return age >= 0 && age < ATTEMPT_MAX_AGE ? safeGoogleReturnPath(attempt.next) : null;
  } catch { return null; }
}

export function startGoogleAttempt(next: string) {
  try {
    sessionStorage.setItem(GOOGLE_ATTEMPT_KEY, JSON.stringify({ next: safeGoogleReturnPath(next), startedAt: Date.now() }));
  } catch { /* Popup recovery remains available without storage. */ }
}

export function clearGoogleAttempt() {
  try { sessionStorage.removeItem(GOOGLE_ATTEMPT_KEY); } catch { /* noop */ }
}