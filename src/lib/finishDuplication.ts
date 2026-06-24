/**
 * Pure helpers that decide whether base/top/single-axis variant dropdowns
 * duplicate the swatch finish picker already rendered by `FinishSelector`.
 *
 * Extracted from `PublicProductPage` so the de-duplication rules can be
 * regression-tested without mounting the full page. Keep this file pure
 * (no React, no Supabase) — it must stay trivially unit-testable.
 *
 * Regression guard: prevents the "Select Your Finish" dropdown from
 * rendering twice when marble/wood/stone options are already exposed as
 * swatches (e.g. Angelo M tables × Alinea marble palette).
 */

import { normalizeFinishOption, normalizeFinishToken } from "./finishNormalization";

const norm = (s: string) => (s || "").trim().toLowerCase();

export const isFinishAxisLabel = (label: string) =>
  /\b(frame|wood|finish|feet|foot|leg|base|legs)\b/i.test(label || "");

/**
 * Build a swatch-name filter for one variant axis (Base or Top).
 *
 * Variant labels frequently bundle several finishes into one compound row
 * because they share the same price tier — e.g.
 *   "Travertino Rosso / Grey Saint Laurent / Picasso Green".
 *
 * The previous prefix-only matcher would keep "Travertino Rosso" (the
 * compound label startsWith the swatch) but drop "Grey Saint Laurent" and
 * "Picasso Green" because the compound label does not start with them.
 * Result: half the swatches linked to the product silently disappeared
 * from the picker (regression noticed on the Alinea Angelo M tables).
 *
 * The token-aware filter below splits compound labels on `/` and `,`,
 * normalizes each piece, and accepts a swatch when its name matches any
 * token (exact, substring either way, or fuzzy via Levenshtein — so
 * "Kynos" ↔ "Kyknos" still passes).
 */
export const makeSwatchAxisFilter = (
  axisOptions: string[],
): ((name: string) => boolean) => {
  const cleanup = (s: string) =>
    (s || "").replace(/\[[^\]]*\]/g, "").trim().toLowerCase();
  const tokens = new Set<string>();
  for (const opt of axisOptions || []) {
    for (const part of (opt || "").split(/\s*[/,]\s*/)) {
      const t = cleanup(part);
      if (t) tokens.add(t);
    }
  }
  const tokenList = Array.from(tokens);
  return (name: string) => {
    const n = cleanup(name);
    if (!n || tokenList.length === 0) return false;
    for (const t of tokenList) {
      if (n === t || n.startsWith(t) || t.startsWith(n) || n.includes(t) || t.includes(n)) {
        return true;
      }
    }
    // Fuzzy fallback for catalogue typos (e.g. swatch "Kyknos" vs variant
    // token "Kynos"). normalizeFinishToken returns the library spelling
    // when it finds a close match, otherwise the original token.
    const normalized = normalizeFinishToken(n, tokenList);
    return normalized !== n;
  };
};

/** A swatch covers an option when their normalized labels overlap (either side substring match). */
export const swatchCoversOption = (option: string, swatch: string): boolean => {
  const a = norm(option);
  const b = norm(swatch);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
};

/**
 * Covers `option` against the library either by direct substring overlap
 * (handled by `swatchCoversOption`) or by typo-tolerant normalization
 * (e.g. variant "Kynos" ↔ library "Kyknos"). Used by every/some helpers
 * so all suppression rules benefit from the same fuzzy matching layer.
 */
const isCoveredByLibrary = (option: string, library: string[]): boolean => {
  if (library.some((s) => swatchCoversOption(option, s))) return true;
  const normalized = normalizeFinishOption(option, library);
  if (!normalized || normalized === option) return false;
  return library.some((s) => swatchCoversOption(normalized, s));
};

export const everyOptionCoveredBySwatches = (
  options: string[],
  swatches: string[],
): boolean => {
  if (!options.length) return false;
  return options.every((o) => isCoveredByLibrary(o, swatches));
};

export const someOptionCoveredBySwatches = (
  options: string[],
  swatches: string[],
): boolean => options.some((o) => isCoveredByLibrary(o, swatches));


export interface SuppressFinishDuplicateInput {
  hasSingleAxisSplit: boolean;
  singleMaterialOptions: string[];
  linkedWoodFinishes: string[];
}

/**
 * Returns true when the parallel single-axis "Select Your Finish" dropdown
 * must be suppressed because the swatch picker in `FinishSelector` is
 * already exposing the same material palette.
 *
 * Rule: as soon as ANY single-axis material option overlaps with a linked
 * swatch (case-insensitive substring either way), the swatch picker is the
 * canonical control and the text dropdown is redundant. We deliberately do
 * not require every option to match — real catalogues frequently contain
 * compound labels ("Travertino Rosso / Grey Saint Laurent / Picasso Green")
 * and stray typos (e.g. variant "Kynos" vs swatch "Kyknos") that would
 * otherwise leak the duplicate dropdown back into the UI.
 */
export const shouldSuppressSingleAsFinish = ({
  hasSingleAxisSplit,
  singleMaterialOptions,
  linkedWoodFinishes,
}: SuppressFinishDuplicateInput): boolean => {
  if (!hasSingleAxisSplit) return false;
  if (!linkedWoodFinishes.length) return false;
  if (!singleMaterialOptions.length) return false;
  return someOptionCoveredBySwatches(singleMaterialOptions, linkedWoodFinishes);
};


export interface SuppressBaseTopInput {
  baseAxisIsDim: boolean;
  topAxisIsDim: boolean;
  baseAxisLabelRaw: string;
  topAxisLabelRaw: string;
  baseOptions: string[];
  topOptions: string[];
  linkedWoodFinishes: string[];
  isUpholstered: boolean;
}

export const shouldSuppressBaseAsFinish = (i: SuppressBaseTopInput): boolean => {
  if (i.baseAxisIsDim) return false;
  const hasWood = i.linkedWoodFinishes.length > 0;
  const allCovered = everyOptionCoveredBySwatches(i.baseOptions, i.linkedWoodFinishes);
  return allCovered || (hasWood && isFinishAxisLabel(i.baseAxisLabelRaw));
};

export const shouldSuppressTopAsFinish = (i: SuppressBaseTopInput): boolean => {
  if (i.topAxisIsDim) return false;
  const someCovered = !i.topAxisIsDim &&
    i.topOptions.length > 0 &&
    someOptionCoveredBySwatches(i.topOptions, i.linkedWoodFinishes);
  return someCovered || (i.isUpholstered && isFinishAxisLabel(i.topAxisLabelRaw));
};
