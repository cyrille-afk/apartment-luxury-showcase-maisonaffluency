/**
 * Single source of truth for "which variant has the user actually selected".
 *
 * Both the product page caption AND the "Add to Quote" flow (and any future
 * price render) must resolve the selected variant identically — otherwise the
 * caption can show one price (e.g. Travertino Rosso €14,263) while the quote
 * line records another (e.g. the RRP default Kynos €12,116).
 *
 * This helper is intentionally pure so it can be shared by render code and
 * event handlers, and covered by unit tests without pulling in React state.
 */

export interface ActiveVariantSelection {
  selectedVariantIdx: number | null;
  selectedBase: string | null;
  selectedTop: string | null;
  selectedDualSize: string | null;
  selectedSingleSize: string | null;
  selectedSingleMaterial: string | null;
}

export interface ActiveVariantContext {
  sizeVariants: any[] | null | undefined;
  isDualAxis: boolean;
  isBaseOnly: boolean;
  hasSingleAxisSplit: boolean;
  hasDualSize: boolean;
  baseOnlyRequiresSize: boolean;
  singleAxisParsed?: Array<{ size: string; material: string; variant: any }>;
}

const norm = (s: any) => String(s ?? "").trim();

export function resolveActiveVariant(
  sel: ActiveVariantSelection,
  ctx: ActiveVariantContext,
): any | null {
  const sv = ctx.sizeVariants;
  if (!sv || sv.length === 0) return null;

  if (ctx.isDualAxis) {
    if (!sel.selectedBase && !sel.selectedTop) return null;
    return (
      sv.find(
        (v) =>
          norm(v.base) === norm(sel.selectedBase) &&
          norm(v.top) === norm(sel.selectedTop) &&
          (!ctx.hasDualSize || norm(v.label) === norm(sel.selectedDualSize)),
      ) ?? null
    );
  }

  if (ctx.isBaseOnly) {
    if (!sel.selectedBase) return null;
    if (ctx.baseOnlyRequiresSize && !sel.selectedDualSize) return null;
    return (
      sv.find(
        (v) =>
          norm(v.base) === norm(sel.selectedBase) &&
          (!ctx.baseOnlyRequiresSize || norm(v.label) === norm(sel.selectedDualSize)),
      ) ?? null
    );
  }

  if (ctx.hasSingleAxisSplit && ctx.singleAxisParsed) {
    if (!sel.selectedSingleSize && !sel.selectedSingleMaterial) return null;
    return (
      ctx.singleAxisParsed.find(
        (p) =>
          p.size === (sel.selectedSingleSize || "") &&
          p.material === (sel.selectedSingleMaterial || ""),
      )?.variant ?? null
    );
  }

  if (sel.selectedVariantIdx != null) return sv[sel.selectedVariantIdx] ?? null;
  return null;
}

/**
 * Priced variant only: returns cents when the resolved variant has a positive
 * `price_cents`, else null (so callers can fall back to a "From X" starting
 * price without accidentally treating 0 as free).
 */
export function resolveActiveVariantCents(
  sel: ActiveVariantSelection,
  ctx: ActiveVariantContext,
): number | null {
  const v = resolveActiveVariant(sel, ctx);
  const c = v?.price_cents;
  return typeof c === "number" && c > 0 ? c : null;
}
