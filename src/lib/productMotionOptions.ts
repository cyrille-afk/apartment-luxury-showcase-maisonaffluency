export type ProductMotionValue = "fixed" | "swivel";

export interface MotionVariantRow {
  label?: string | null;
  base?: string | null;
  top?: string | null;
  price_cents?: number | null;
}

export interface ProductMotionOptions {
  dimensions: string;
  fixedVariantLabel: string;
  swivelVariantLabel: string;
}

const SWIVEL_RE = /^\s*swivel\b[\s:–—-]*/i;

const cleanLabel = (value: string | null | undefined) => String(value ?? "").trim();

export function motionValueFromVariantLabel(
  label: string | null | undefined,
): ProductMotionValue {
  return SWIVEL_RE.test(cleanLabel(label)) ? "swivel" : "fixed";
}

export function dimensionsFromMotionLabel(label: string | null | undefined): string {
  return cleanLabel(label).replace(SWIVEL_RE, "").trim();
}

/**
 * Motion is a dedicated control only when the catalogue explicitly contains
 * matching swivel and non-swivel versions of the same dimensions. This keeps
 * the treatment data-driven and prevents it appearing on unrelated products.
 */
export function resolveProductMotionOptions(
  variants: MotionVariantRow[] | null | undefined,
): ProductMotionOptions | null {
  if (!variants?.length) return null;

  const fixed = variants.find((variant) => {
    const label = cleanLabel(variant.label);
    return label && !SWIVEL_RE.test(label);
  });
  if (!fixed?.label) return null;

  const dimensions = dimensionsFromMotionLabel(fixed.label);
  const swivel = variants.find((variant) => {
    const label = cleanLabel(variant.label);
    return SWIVEL_RE.test(label) && dimensionsFromMotionLabel(label) === dimensions;
  });
  if (!swivel?.label || !dimensions) return null;

  return {
    dimensions,
    fixedVariantLabel: cleanLabel(fixed.label),
    swivelVariantLabel: cleanLabel(swivel.label),
  };
}

export function variantLabelForMotion(
  options: ProductMotionOptions,
  motion: ProductMotionValue,
): string {
  return motion === "swivel" ? options.swivelVariantLabel : options.fixedVariantLabel;
}