/**
 * Decides which variant a product page should arrive with already chosen.
 *
 * A product may carry `default_variant_label` (curator pick field, mirrored to
 * the public picks table and the trade product twin). When that value names one
 * of the product's size variants, the size picker opens on it instead of the
 * empty "Select Your Size" placeholder.
 *
 * This is only the first-paint answer: a selection restored from the visitor's
 * own session, or anything they click afterwards, always wins over the default.
 *
 * Matching is deliberately tolerant so a curator can store just the leading
 * word ("Large") against a full label ("Large — W 350 × D 125 × H 72.4 cm").
 *
 * Pure function, no React, no DOM — covered by unit tests.
 */

export interface VariantLabelRow {
  label?: string | null;
}

export interface DefaultVariantMatch {
  /** Position within the deduped label list — the same space the picker indexes. */
  index: number;
  /** The exact variant label that matched. */
  label: string;
}

/**
 * Variant labels in display order: trimmed, blank entries dropped, repeats
 * collapsed to their first occurrence. Both product pages build their size
 * picker from this list, so an index here is a valid picker index.
 */
export function dedupeVariantLabels(
  variants: VariantLabelRow[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const v of variants || []) {
    const raw = (v?.label || "").trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    labels.push(raw);
  }
  return labels;
}

/** True when `candidate` begins with `wanted` at a word boundary. */
function startsWithWord(candidate: string, wanted: string): boolean {
  if (!candidate.toLowerCase().startsWith(wanted.toLowerCase())) return false;
  const next = candidate[wanted.length];
  // Exact length was handled by the equality pass; here the next character
  // must NOT be alphanumeric, so "Large" never matches "Larger".
  return next === undefined || !/[a-z0-9]/i.test(next);
}

/** True when `wanted` appears anywhere in `candidate`, at a word boundary. */
function containsWord(candidate: string, wanted: string): boolean {
  const hay = candidate.toLowerCase();
  const needle = wanted.toLowerCase();
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 ? undefined : hay[at - 1];
    const after = hay[at + needle.length];
    const beforeOk = before === undefined || !/[a-z0-9]/i.test(before);
    const afterOk = after === undefined || !/[a-z0-9]/i.test(after);
    if (beforeOk && afterOk) return true;
    from = at + 1;
  }
}

/**
 * Returns the variant to pre-select, or null when the product has no default
 * or the default names nothing in its own variant list.
 */
export function resolveDefaultVariant(
  variants: VariantLabelRow[] | null | undefined,
  defaultLabel: string | null | undefined,
): DefaultVariantMatch | null {
  const wanted = (defaultLabel || "").trim();
  if (!wanted) return null;

  const labels = dedupeVariantLabels(variants);
  if (!labels.length) return null;

  // 1. Exact label (case-insensitive).
  const exact = labels.findIndex((l) => l.toLowerCase() === wanted.toLowerCase());
  if (exact >= 0) return { index: exact, label: labels[exact] };

  // 2. Word prefix: "Large" → "Large — W 350 × D 125 × H 72.4 cm".
  const prefix = labels.findIndex((l) => startsWithWord(l, wanted));
  if (prefix >= 0) return { index: prefix, label: labels[prefix] };

  // 3. Last resort: the default names a whole word inside a label, e.g. "W 350".
  const contains = labels.findIndex((l) => containsWord(l, wanted));
  return contains >= 0 ? { index: contains, label: labels[contains] } : null;
}
