/**
 * Single source of truth for the trade pricing chain.
 *   Trade price  = RRP × (1 − tier discount fraction)
 *   Client price = Trade price × project trade multiplier
 * `current_trade_discount_pct` returns a FRACTION (0.10 = 10%).
 */
export function toDiscountFraction(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Defensive: tolerate legacy percentage values (e.g. 10) by converting.
  const f = n > 1 ? n / 100 : n;
  return Math.min(f, 0.95);
}

export const discountPercentLabel = (fraction: number) =>
  `${Math.round(fraction * 10000) / 100}%`;

export function tradePriceCents(rrpCents: number | null | undefined, fraction: number): number | null {
  if (rrpCents == null || rrpCents <= 0) return null;
  return Math.round(rrpCents * (1 - fraction));
}

export function normalizeMultiplier(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function clientPriceCents(tradeCents: number | null, multiplier: number): number | null {
  if (tradeCents == null) return null;
  return Math.round(tradeCents * normalizeMultiplier(multiplier));
}

/** A project's explicit multiplier takes precedence over the studio's default markup. */
export function effectiveProjectMultiplier(projectMultiplier: unknown, studioMarkupPercentage: unknown): number {
  const project = Number(projectMultiplier);
  if (Number.isFinite(project) && project > 0 && project !== 1) return project;
  const markup = Number(studioMarkupPercentage);
  return Number.isFinite(markup) && markup >= 0 ? 1 + markup / 100 : 1;
}

/**
 * Client-facing unit price. With no markup configured (multiplier 1) the client
 * sees retail (RRP) — never the designer's net trade price.
 */
export function clientUnitCents(rrpCents: number | null | undefined, fraction: number, multiplier: number): number | null {
  if (rrpCents == null || rrpCents <= 0) return null;
  const m = normalizeMultiplier(multiplier);
  if (m === 1) return Math.round(rrpCents);
  return clientPriceCents(tradePriceCents(rrpCents, fraction), m);
}
