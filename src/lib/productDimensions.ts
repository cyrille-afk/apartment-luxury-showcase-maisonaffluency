/**
 * Unified product dimension model.
 *
 * Every workspace/canvas product resolves to a standardized
 * `{ w, d, h }` metric object (millimetres) from whichever backend
 * field carries the data: explicit *_mm columns, the free-text
 * `dimensions` string, or the first usable `size_variants` entry.
 */

export type ProductDimensions = { w: number; d: number; h: number };

export const DIMENSIONS_PLACEHOLDER = "Dimensions // Requesting data";

type DimensionSource = {
  dimensions?: string | null;
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  size_variants?: Array<{ label?: string | null; base?: string | null; top?: string | null }> | null;
};

function toMm(value: string, unitFactor: number) {
  return Math.round(Number(value) * unitFactor);
}

/** Parse a free-text dimension string such as "W 82 × D 77 × H 73 cm — SH 41 cm". */
export function parseDimensionString(raw?: string | null): ProductDimensions | null {
  if (!raw) return null;
  const text = String(raw);
  const unitFactor = /\bmm\b/i.test(text) ? 1 : 10;

  const width = text.match(/\bW\s*([\d.]+)/i);
  const depth = text.match(/\bD\s*([\d.]+)/i);
  // Avoid matching "SH" (seat height).
  const height = text.match(/(?:^|[^A-Za-z])H\s*([\d.]+)/i);
  const diameter = text.match(/[ØøΦ]\s*([\d.]+)/);

  if (width?.[1] && depth?.[1] && height?.[1]) {
    return {
      w: toMm(width[1], unitFactor),
      d: toMm(depth[1], unitFactor),
      h: toMm(height[1], unitFactor),
    };
  }

  if (diameter?.[1] && height?.[1]) {
    const dia = toMm(diameter[1], unitFactor);
    return { w: dia, d: dia, h: toMm(height[1], unitFactor) };
  }

  return null;
}

/** Resolve standardized dimensions for any product-like record. */
export function resolveDimensions(product?: DimensionSource | null): ProductDimensions | null {
  if (!product) return null;

  if (product.width_mm && product.depth_mm && product.height_mm) {
    return {
      w: Math.round(product.width_mm),
      d: Math.round(product.depth_mm),
      h: Math.round(product.height_mm),
    };
  }

  const fromString = parseDimensionString(product.dimensions);
  if (fromString) return fromString;

  for (const variant of product.size_variants || []) {
    const parsed =
      parseDimensionString(variant?.label) ||
      parseDimensionString(variant?.base) ||
      parseDimensionString(variant?.top);
    if (parsed) return parsed;
  }

  return null;
}

/** Render the canonical badge string: `820 × 770 × 730 mm`. */
export function formatDimensions(dims: ProductDimensions | null): string | null {
  if (!dims) return null;
  return `${dims.w} × ${dims.d} × ${dims.h} mm`;
}

/** Badge text for a product, falling back to the requesting-data placeholder. */
export function dimensionBadgeLabel(product?: DimensionSource | null): string {
  return formatDimensions(resolveDimensions(product)) || DIMENSIONS_PLACEHOLDER;
}
