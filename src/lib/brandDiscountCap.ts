/**
 * Brand-specific margin caps.
 *
 * Some suppliers run on tight margins, so admins can set an optional
 * `designers.max_trade_discount` (percent, e.g. 5 = 5%). Wherever a trade
 * discount is calculated — Trade Gallery, quote builder, cart checkout — the
 * effective rate is `min(tier discount, brand cap)`.
 *
 * The same rule is re-derived server-side in `create-cart-checkout`, so the
 * charged amount always matches the displayed one.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrandToParent } from "@/lib/brandNormalization";

/** Map of normalized brand key → cap expressed as a fraction (0.05 = 5%). */
export type BrandDiscountCaps = Map<string, number>;

/** Normalizes a brand / designer label into a stable lookup key. */
export function brandCapKey(name: string | null | undefined): string {
  const raw = (name || "").trim();
  if (!raw) return "";
  // "Brand - Designer" collapses to the parent house.
  const parent = raw.includes(" - ") ? raw.split(" - ")[0].trim() : raw;
  return normalizeBrandToParent(parent)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Cap (fraction) for a brand, or null when the supplier has no cap. */
export function brandCapFor(
  brandName: string | null | undefined,
  caps: BrandDiscountCaps | null | undefined,
): number | null {
  if (!caps || caps.size === 0) return null;
  const key = brandCapKey(brandName);
  if (!key) return null;
  const cap = caps.get(key);
  return typeof cap === "number" ? cap : null;
}

export interface EffectiveDiscount {
  /** Rate actually applicable to this line, as a fraction. */
  pct: number;
  /** True when the brand cap is lower than the member's tier rate. */
  capped: boolean;
  /** The brand cap that applied, as a fraction (null when none). */
  capPct: number | null;
}

/** min(tier discount, brand cap) — the single rule used everywhere. */
export function effectiveDiscountForBrand(
  tierPct: number,
  brandName: string | null | undefined,
  caps: BrandDiscountCaps | null | undefined,
): EffectiveDiscount {
  const tier = Number.isFinite(tierPct) && tierPct > 0 ? tierPct : 0;
  const cap = brandCapFor(brandName, caps);
  if (cap === null) return { pct: tier, capped: false, capPct: null };
  const pct = Math.min(tier, Math.max(0, cap));
  return { pct, capped: pct < tier, capPct: cap };
}

/** Copy shown next to a line price whenever the cap suppressed the discount. */
export const MARGIN_CAP_TOOLTIP = "Max margin cap applied for this supplier.";

/** Loads every configured brand cap (small table, cached for 10 minutes). */
export function useBrandDiscountCaps(enabled = true) {
  const { data } = useQuery({
    queryKey: ["brand-discount-caps"],
    enabled,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<BrandDiscountCaps> => {
      const { data, error } = await (supabase as any)
        .from("designers")
        .select("name, display_name, max_trade_discount")
        .not("max_trade_discount", "is", null);
      if (error) throw error;
      const map: BrandDiscountCaps = new Map();
      (data || []).forEach((row: any) => {
        const pct = Number(row.max_trade_discount);
        if (!Number.isFinite(pct) || pct < 0) return;
        const fraction = pct / 100;
        [row.name, row.display_name].forEach((label: string | null) => {
          const key = brandCapKey(label);
          if (key) map.set(key, fraction);
        });
      });
      return map;
    },
  });

  return data ?? (EMPTY_CAPS as BrandDiscountCaps);
}

const EMPTY_CAPS: BrandDiscountCaps = new Map();
