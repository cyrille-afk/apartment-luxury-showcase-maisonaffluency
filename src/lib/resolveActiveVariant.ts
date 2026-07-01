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

/**
 * "From €X" cheapest-matching price for a dual-axis product where the user
 * has picked only ONE axis (e.g. finish but not size, or size but not finish).
 * Both the on-page price caption and the "Add to Quote" flow MUST read this
 * so the quote line matches what the user saw. Returns null when no partial
 * selection is made, when the product isn't dual-axis, or when no priced
 * variant matches.
 */
export function resolvePartialDualMinCents(
  sel: Pick<ActiveVariantSelection, "selectedBase" | "selectedTop" | "selectedDualSize">,
  ctx: Pick<ActiveVariantContext, "sizeVariants" | "isDualAxis">,
): number | null {
  if (!ctx.isDualAxis || !ctx.sizeVariants || ctx.sizeVariants.length === 0) return null;
  if (!sel.selectedBase && !sel.selectedTop && !sel.selectedDualSize) return null;
  const matches = ctx.sizeVariants.filter(
    (v: any) =>
      (!sel.selectedBase || norm(v.base) === norm(sel.selectedBase)) &&
      (!sel.selectedTop || norm(v.top) === norm(sel.selectedTop)) &&
      (!sel.selectedDualSize || norm(v.label) === norm(sel.selectedDualSize)),
  );
  const priced = matches
    .map((v: any) => v.price_cents)
    .filter((c: any) => typeof c === "number" && c > 0) as number[];
  return priced.length ? Math.min(...priced) : null;
}

