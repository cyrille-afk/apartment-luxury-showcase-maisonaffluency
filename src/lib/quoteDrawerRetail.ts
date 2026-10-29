import { configuredProductPrice } from "./configuredProductPrice";
import { type QuoteFinishVariant } from "./quoteFinishSwatches";

type RetailLine = {
  variant_label?: string | null;
  fabric_id?: string | null;
  fabric_upcharge_cents?: number | null;
  fabric_currency?: string | null;
  fabric?: { price_per_lm_cents?: number | null; currency?: string | null } | null;
  woodRetail?: { cents: number; currency: string } | null;
  product?: {
    rrp_price_cents?: number | null;
    currency?: string | null;
    size_variants?: QuoteFinishVariant[] | null;
  } | null;
};

const key = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

/** Resolve catalogue retail independently of saved quote unit/net prices. */
export function quoteDrawerRetail(line: RetailLine): { cents: number; currency: string } | null {
  const currency = (line.product?.currency || "EUR").toUpperCase();
  let base = line.product?.rrp_price_cents ?? null;
  const variants = line.product?.size_variants ?? [];
  if (variants.some((variant) => (variant.price_cents ?? 0) > 0)) {
    const selection = ` ${key(line.variant_label || "")} `;
    const matched = variants.filter((variant) => {
      const axes = [variant.base, variant.top, variant.size, variant.label].filter((axis): axis is string => Boolean(axis));
      return axes.length > 0 && axes.every((axis) => selection.includes(` ${key(axis)} `));
    });
    // Never choose a cheapest/starting variant for a saved configuration.
    if (matched.length !== 1) return null;
    base = (matched[0].price_cents ?? 0) > 0 ? matched[0].price_cents ?? null : base;
  }
  if (line.woodRetail) {
    if (line.woodRetail.currency.toUpperCase() !== currency) return null;
    base = line.woodRetail.cents;
  }
  if (!base || base <= 0) return null;
  const surcharge = line.fabric_upcharge_cents;
  if (surcharge == null && line.fabric_id && (line.fabric?.price_per_lm_cents ?? 0) > 0) return null;
  if (surcharge != null && surcharge < 0) return null;
  if (surcharge && (line.fabric_currency || line.fabric?.currency || currency).toUpperCase() !== currency) return null;
  return { cents: configuredProductPrice(base, surcharge ?? 0, 0).retailCents, currency };
}