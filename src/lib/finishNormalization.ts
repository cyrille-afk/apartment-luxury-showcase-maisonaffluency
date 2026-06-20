/**
 * Fuzzy finish-label normalization.
 *
 * Variant labels in the catalogue (entered by hand from supplier spec sheets)
 * frequently disagree with the canonical names in the designer's swatch
 * library — e.g. "Kynos" (variant) vs "Kyknos" (library). Without
 * normalization the dedupe + suppression checks in `finishDuplication.ts`
 * treat the two as distinct options and the public product page renders a
 * duplicate "Select Your Finish" dropdown beside the swatch picker.
 *
 * This module is intentionally pure (no React / Supabase) so it can be
 * exercised by Vitest without mounting the page. It is the single source of
 * truth for "given this raw option and the library, what is the canonical
 * library spelling?".
 */

/** Iterative two-row Levenshtein. Case is the caller's responsibility. */
const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
};

/**
 * Maximum edit distance allowed for a single-word typo correction. Capped
 * at 2 to prevent unrelated finishes from collapsing into one another (e.g.
 * "Oak" and "Ash" must remain distinct — their distance is 2 but their
 * lengths are too short to qualify under the proportional rule below).
 */
const FUZZ_MAX = 2;

/**
 * Map a single finish token to its canonical library spelling.
 *
 * Resolution order:
 *  1. Exact case-insensitive match → return library spelling.
 *  2. Substring either way (e.g. "Bianco" ↔ "Bianco Statuarietto").
 *  3. Levenshtein ≤ min(FUZZ_MAX, floor(minLen / 3)) → return library
 *     spelling. The proportional cap keeps short labels safe ("Oak" vs
 *     "Ash" stays a non-match; "Kynos" vs "Kyknos" becomes a match).
 *
 * Falls back to the original token if nothing qualifies.
 */
export const normalizeFinishToken = (token: string, library: string[]): string => {
  const t = (token || "").trim();
  if (!t || !library.length) return token;
  const lower = t.toLowerCase();

  // 1. Exact (case-insensitive)
  const exact = library.find((l) => l.trim().toLowerCase() === lower);
  if (exact) return exact;

  // 2. Substring either direction — pick the library entry that matches
  //    with the smallest length delta so "Bianco" prefers "Bianco
  //    Statuarietto" over a longer "Bianco …" if both qualified.
  let sub: { name: string; delta: number } | null = null;
  for (const l of library) {
    const ll = l.trim().toLowerCase();
    if (!ll) continue;
    if (ll === lower) return l; // safety net, already handled above
    if (ll.includes(lower) || lower.includes(ll)) {
      const delta = Math.abs(ll.length - lower.length);
      if (!sub || delta < sub.delta) sub = { name: l, delta };
    }
  }
  if (sub) return sub.name;

  // 3. Fuzzy edit-distance match
  let best: { name: string; d: number } | null = null;
  for (const l of library) {
    const ll = l.trim().toLowerCase();
    if (!ll) continue;
    const d = levenshtein(lower, ll);
    if (!best || d < best.d) best = { name: l, d };
  }
  if (best) {
    const cap = Math.min(FUZZ_MAX, Math.floor(Math.min(lower.length, best.name.length) / 3));
    if (best.d > 0 && best.d <= cap) return best.name;
  }

  return token;
};

/**
 * Normalize a finish OPTION, which may be a single token or a compound
 * "X / Y / Z" label (Alinea encodes price tiers that way). Each slash-
 * separated part is normalized independently.
 */
export const normalizeFinishOption = (option: string, library: string[]): string => {
  if (!option || !library.length) return option;
  if (option.includes("/")) {
    return option
      .split("/")
      .map((p) => normalizeFinishToken(p.trim(), library))
      .join(" / ");
  }
  return normalizeFinishToken(option, library);
};

/**
 * Normalize a list of finish options against a library and collapse
 * duplicates that emerged from the normalization (e.g. variants that
 * spelled the same finish two different ways). First-seen casing wins.
 */
export const normalizeFinishOptions = (options: string[], library: string[]): string[] => {
  if (!library.length) return [...options];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const o of options) {
    const n = normalizeFinishOption(o, library);
    const key = (n || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
};
