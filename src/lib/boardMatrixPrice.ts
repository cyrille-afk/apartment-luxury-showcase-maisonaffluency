type Variant = { label?: string; price_cents?: number };
const positive = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** Exact configured prices outrank base prices; size-only fallback is indicative. */
export function boardMatrixPrice(base: number | null | undefined, variants: unknown, finish?: { label?: string; price_cents?: number | null } | null) {
  if (positive(finish?.price_cents)) return { cents: finish.price_cents, from: false };
  const rows: Variant[] = Array.isArray(variants) ? variants.filter(v => v && positive(v.price_cents)) : [];
  const label = finish?.label?.trim().toLocaleLowerCase();
  const exact = label ? rows.filter(v => v.label?.trim().toLocaleLowerCase() === label) : [];
  if (exact.length && new Set(exact.map(v => v.price_cents)).size === 1) return { cents: exact[0].price_cents ?? null, from: false };
  if (positive(base)) return { cents: base, from: false };
  return { cents: rows.length ? Math.min(...rows.map(v => v.price_cents ?? Infinity)) : null, from: rows.length > 0 };
}