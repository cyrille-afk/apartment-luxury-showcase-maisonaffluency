import { buildProductFinishMap, findVariantForImageIndex, normFinish } from "@/lib/variantImageMap";

type Variant = { label?: string | null; base?: string | null; top?: string | null; price_cents?: number | null };

/**
 * Price of the finish pairing shown in a product's photo at `imageIndex`
 * (default: the primary image). Used by room-photo cards so they quote the
 * pictured finish, exactly like the product page, instead of the cheapest
 * "From" variant. Returns null when the photo isn't tied to one priced variant.
 */
export function picturedVariantPriceCents(
  rawMap: unknown,
  variants: Variant[] | null | undefined,
  imageIndex = 0,
  /** Priced variant rows (trade pricing). The public pick view strips prices,
   *  so match the photo against `variants` and read prices from here. */
  pricedVariants?: Variant[] | null,
): number | null {
  const map = buildProductFinishMap(rawMap);
  const list = Array.isArray(variants) ? variants : [];
  if (!map || !list.length) return null;
  const pricedList = Array.isArray(pricedVariants) ? pricedVariants : list;
  const same = (a: Variant, b: Variant) =>
    (a.base || "").trim() === (b.base || "").trim() &&
    (a.top || "").trim() === (b.top || "").trim() &&
    (a.label || "").trim() === (b.label || "").trim();
  const priced = (v: Variant | undefined) => {
    const row = v ? pricedList.find((p) => same(p, v)) : undefined;
    return row && typeof row.price_cents === "number" && row.price_cents > 0 ? row.price_cents : null;
  };

  // 1) Canonical keys (base|top|size, base|top, single axis).
  const hit = findVariantForImageIndex(map, list, imageIndex);
  if (hit) {
    const row = list.find(
      (v) =>
        (v.base || "").trim() === (hit.base || "") &&
        (v.top || "").trim() === (hit.top || "") &&
        (v.label || "").trim() === (hit.label || ""),
    );
    const c = priced(row);
    if (c != null) return c;
  }

  // 2) Descriptive keys (e.g. "w170…|topinbrushedoceanonyxlegsinunfilled…"):
  // a variant matches when every one of its axis values appears in the key.
  const keys = Object.entries(map).filter(([, i]) => i === imageIndex).map(([k]) => k.replace(/\|/g, ""));
  if (!keys.length) return null;
  const matches = list.filter((v) => {
    const parts = [v.base, v.top, v.label].map((p) => normFinish((p || "").trim())).filter(Boolean);
    return parts.length > 0 && keys.some((k) => parts.every((p) => k.includes(p)));
  });
  const prices = Array.from(new Set(matches.map(priced).filter((c): c is number => c != null)));
  return prices.length === 1 ? prices[0] : null;
}
