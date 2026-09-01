/**
 * Crate packing lists and finish-driven HS codes.
 *
 * A product may ship in several crates, and different sizes of the same
 * product can require a different crate set. Each crate carries its own
 * packed dimensions, weight, crating price and (optionally) its own HS code —
 * customs classification changes with the dominant material (wood, marble,
 * metal, glass…), so the HS code is resolved from the selected finish.
 *
 * Stored as JSONB on `designer_curator_picks.crate_specs` / `hs_code_rules`
 * and mirrored to `trade_products` by a database trigger.
 */

export interface CrateSpec {
  /** Stable client id, used as a React key. */
  id: string;
  /** Human label, e.g. "Crate 1 — Seat shell". */
  label: string;
  /**
   * Size/variant this crate belongs to. Empty string = applies to every size.
   * Matched against `size_variants[].label`.
   */
  size_label: string;
  /** Number of identical crates of this spec per unit ordered. */
  qty: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  /** Volume in m³ (auto-computed from dimensions when they are present). */
  cbm: number | null;
  weight_kg: number | null;
  /** Crating / packing charge in minor units. */
  crate_price_cents: number | null;
  currency: string;
  /** Optional per-crate customs code (overrides the product-level code). */
  hs_code: string;
}

export interface HsCodeRule {
  id: string;
  /** Material or finish keyword, e.g. "Oak", "Marble", "Brass". */
  material: string;
  hs_code: string;
}

export const CRATE_MATERIAL_PRESETS = [
  "Wood",
  "Marble",
  "Stone",
  "Metal",
  "Brass",
  "Glass",
  "Ceramic",
  "Upholstery",
  "Leather",
  "Rattan",
] as const;

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `c${Date.now()}${Math.random().toString(16).slice(2)}`);

export function emptyCrate(currency = "EUR"): CrateSpec {
  return {
    id: uid(),
    label: "",
    size_label: "",
    qty: 1,
    length_cm: null,
    width_cm: null,
    height_cm: null,
    cbm: null,
    weight_kg: null,
    crate_price_cents: null,
    currency,
    hs_code: "",
  };
}

export function emptyHsRule(): HsCodeRule {
  return { id: uid(), material: "", hs_code: "" };
}

/** Volume in m³ from centimetre dimensions, rounded to 3 decimals. */
export function crateCbm(c: Pick<CrateSpec, "length_cm" | "width_cm" | "height_cm">): number | null {
  const { length_cm: l, width_cm: w, height_cm: h } = c;
  if (![l, w, h].every((n) => typeof n === "number" && Number.isFinite(n) && (n as number) > 0)) {
    return null;
  }
  return Math.round(((l as number) * (w as number) * (h as number)) / 1_000_000 * 1000) / 1000;
}

/** Tolerant parse of the JSONB column into a typed array. */
export function parseCrateSpecs(raw: unknown): CrateSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => {
      const n = typeof v === "string" ? parseFloat(v) : (v as number);
      return Number.isFinite(n) ? (n as number) : null;
    };
    return {
      id: typeof o.id === "string" && o.id ? o.id : uid(),
      label: typeof o.label === "string" ? o.label : "",
      size_label: typeof o.size_label === "string" ? o.size_label : "",
      qty: Math.max(1, Math.round(num(o.qty) ?? 1)),
      length_cm: num(o.length_cm),
      width_cm: num(o.width_cm),
      height_cm: num(o.height_cm),
      cbm: num(o.cbm),
      weight_kg: num(o.weight_kg),
      crate_price_cents: num(o.crate_price_cents),
      currency: typeof o.currency === "string" && o.currency ? o.currency : "EUR",
      hs_code: typeof o.hs_code === "string" ? o.hs_code : "",
    } satisfies CrateSpec;
  });
}

export function parseHsCodeRules(raw: unknown): HsCodeRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      id: typeof o.id === "string" && o.id ? o.id : uid(),
      material: typeof o.material === "string" ? o.material : "",
      hs_code: typeof o.hs_code === "string" ? o.hs_code : "",
    } satisfies HsCodeRule;
  });
}

/** Crates that apply to a given size label (size-specific first, then generic). */
export function cratesForSize(crates: CrateSpec[], sizeLabel?: string | null): CrateSpec[] {
  const target = (sizeLabel || "").trim().toLowerCase();
  const specific = target
    ? crates.filter((c) => c.size_label.trim().toLowerCase() === target)
    : [];
  if (specific.length) return specific;
  return crates.filter((c) => !c.size_label.trim());
}

export interface CrateTotals {
  count: number;
  cbm: number;
  weightKg: number;
  priceCents: number;
  currency: string;
}

export function crateTotals(crates: CrateSpec[]): CrateTotals {
  return crates.reduce<CrateTotals>(
    (acc, c) => ({
      count: acc.count + (c.qty || 1),
      cbm: Math.round((acc.cbm + (c.cbm ?? crateCbm(c) ?? 0) * (c.qty || 1)) * 1000) / 1000,
      weightKg: Math.round((acc.weightKg + (c.weight_kg ?? 0) * (c.qty || 1)) * 100) / 100,
      priceCents: acc.priceCents + (c.crate_price_cents ?? 0) * (c.qty || 1),
      currency: c.currency || acc.currency,
    }),
    { count: 0, cbm: 0, weightKg: 0, priceCents: 0, currency: crates[0]?.currency || "EUR" }
  );
}

/**
 * Resolve the customs code for a selected finish/material.
 * Rules are matched case-insensitively against the finish text; the longest
 * matching keyword wins so "Oiled Oak" beats a generic "Oak" rule.
 */
export function resolveHsCode(
  rules: HsCodeRule[],
  finishText: string | null | undefined,
  fallback?: string | null
): string | null {
  const hay = (finishText || "").toLowerCase();
  if (hay) {
    const hit = rules
      .filter((r) => r.material.trim() && r.hs_code.trim())
      .filter((r) => hay.includes(r.material.trim().toLowerCase()))
      .sort((a, b) => b.material.length - a.material.length)[0];
    if (hit) return hit.hs_code.trim();
  }
  return fallback?.trim() || null;
}
