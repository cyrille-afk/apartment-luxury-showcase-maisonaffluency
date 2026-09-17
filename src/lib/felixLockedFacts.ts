import type { FelixBriefFacts } from "@/lib/felixOnboardingGate";
import { hasRealBriefValue } from "@/lib/felixOnboardingGate";

/**
 * Verified project facts are LOCKED once the user states them. A network
 * timeout, a "Resume brief" retry or a semantic backend guess must never be
 * able to downgrade a confirmed "Prewar Co-op" into a placeholder or an
 * unrelated typology ("Brownstone"). We therefore keep a monotonic cache:
 * real values overwrite empty/placeholder ones, never the reverse.
 */
const KEY = "felix:locked-facts:v1";

export const EMPTY_LOCKED_FACTS: FelixBriefFacts = { projectProfile: "", zone: "", budget: "" };

export function loadLockedFacts(): FelixBriefFacts {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_LOCKED_FACTS };
    const parsed = JSON.parse(raw) as Partial<FelixBriefFacts>;
    return {
      projectProfile: String(parsed.projectProfile || ""),
      zone: String(parsed.zone || ""),
      budget: String(parsed.budget || ""),
    };
  } catch {
    return { ...EMPTY_LOCKED_FACTS };
  }
}

/** Merge candidate facts onto locked ones — only real values win. */
export function mergeLockedFacts(
  locked: FelixBriefFacts,
  candidate: Partial<FelixBriefFacts>,
): FelixBriefFacts {
  const next = { ...locked };
  (Object.keys(EMPTY_LOCKED_FACTS) as Array<keyof FelixBriefFacts>).forEach((key) => {
    const value = candidate[key];
    if (hasRealBriefValue(value) && !hasRealBriefValue(next[key])) next[key] = String(value).trim();
  });
  return next;
}

export function persistLockedFacts(facts: FelixBriefFacts): void {
  try { localStorage.setItem(KEY, JSON.stringify(facts)); } catch { /* non-fatal */ }
}

export function clearLockedFacts(): void {
  try { localStorage.removeItem(KEY); } catch { /* non-fatal */ }
}

/** True when nothing has been locked yet. */
export const hasLockedFacts = (facts: FelixBriefFacts): boolean =>
  hasRealBriefValue(facts.projectProfile) || hasRealBriefValue(facts.zone) || hasRealBriefValue(facts.budget);
