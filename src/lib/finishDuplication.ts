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

const norm = (s: string) => (s || "").trim().toLowerCase();

export const isFinishAxisLabel = (label: string) =>
  /\b(frame|wood|finish|feet|foot|leg|base|legs)\b/i.test(label || "");

/** A swatch covers an option when their normalized labels overlap (either side substring match). */
export const swatchCoversOption = (option: string, swatch: string): boolean => {
  const a = norm(option);
  const b = norm(swatch);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
};

export const everyOptionCoveredBySwatches = (
  options: string[],
  swatches: string[],
): boolean => {
  if (!options.length) return false;
  return options.every((o) => swatches.some((s) => swatchCoversOption(o, s)));
};

export const someOptionCoveredBySwatches = (
  options: string[],
  swatches: string[],
): boolean => options.some((o) => swatches.some((s) => swatchCoversOption(o, s)));

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
