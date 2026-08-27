/**
 * Shared logic for variant dropdown placeholders.
 *
 * Resolution order for Base / Top dropdowns:
 *   1. `variant_placeholder` (curator override) — applied to BOTH dropdowns when set.
 *   2. Axis-specific label → "Select your {label} finish"
 *      (e.g. "Plinth" → "Select your plinth finish")
 *   3. Generic per-axis default — Base: "Select your base finish",
 *                                 Top:  "Select your top finish".
 *      Both axes mirror each other for clarity ("base finish" / "top finish").

 *
 * All string inputs are trimmed and treated as missing if empty/whitespace.
 */

export interface VariantPlaceholderInput {
  variant_placeholder?: string | null;
  base_axis_label?: string | null;
  top_axis_label?: string | null;
}

const DEFAULT_BASE_PLACEHOLDER = "Select Your Base Finish";
const DEFAULT_TOP_PLACEHOLDER = "Select Your Top Finish";
const DEFAULT_MATERIAL_PLACEHOLDER = "Select Your Finish";

/** Returns the input string trimmed, or null if empty/whitespace/nullish. */
function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatVariantAxisLabel(label: string | null | undefined): string | null {
  const axis = clean(label);
  if (!axis) return null;
  return axis.replace(/\buphostery\b/gi, "Upholstery");
}

export function isDimensionAxisLabel(label: string | null | undefined): boolean {
  const axis = clean(label)?.toLowerCase();
  if (!axis) return false;
  return /^(size|sizes|dimension|dimensions|measurements?|diameter|height|width|depth|length)$/.test(axis);
}

function placeholderFromAxisLabel(label: string): string {
  let pretty = formatVariantAxisLabel(label)!;
  // Fix common DB truncations: "fini" → "Finish"
  pretty = pretty.replace(/\bfini\b/gi, "Finish");
  if (isDimensionAxisLabel(pretty)) return "Select Your Size";
  // Title-case each word so the placeholder matches the "Select Your X" convention
  // used by the swatch picker (e.g. "Select Your Rod Finish", "Select Your Diffuser").
  const titled = pretty
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  const skipSuffix = /\b(finish|fabric|material|size|colour|color|leather|diffuser|shade|model|version|variant|option)$/i.test(titled);
  return skipSuffix ? `Select Your ${titled}` : `Select Your ${titled} Finish`;
}

function normalizePlaceholder(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized === "select your size" || normalized === "your sofa size" || normalized === "select your sofa size" ? "Select Your Size" : value;
}

export function getBasePlaceholder(p: VariantPlaceholderInput): string {
  // Axis-specific label wins when set — it reads naturally per dropdown
  // (e.g. "Select your frame choice"). Fall back to the curator override
  // (which applies to both dropdowns) only when no axis label is defined,
  // then to the generic default.
  const axis = formatVariantAxisLabel(p.base_axis_label);
  if (axis) return placeholderFromAxisLabel(axis);

  const override = clean(p.variant_placeholder);
  if (override) return normalizePlaceholder(override);

  return DEFAULT_BASE_PLACEHOLDER;
}

export function getTopPlaceholder(p: VariantPlaceholderInput): string {
  const axis = formatVariantAxisLabel(p.top_axis_label);
  if (axis) return placeholderFromAxisLabel(axis);

  const override = clean(p.variant_placeholder);
  if (override) return normalizePlaceholder(override);

  return DEFAULT_TOP_PLACEHOLDER;
}


/** Default placeholder for non-dual-axis material/size dropdowns. */
export function getMaterialPlaceholder(p: VariantPlaceholderInput): string {
  const override = clean(p.variant_placeholder);
  return override ? normalizePlaceholder(override) : DEFAULT_MATERIAL_PLACEHOLDER;
}

/** True when an axis label describes a soft/upholstery axis (fabric, leather, hide…). */
export function isUpholsteryAxisLabel(label: string | null | undefined): boolean {
  const axis = clean(label)?.toLowerCase();
  if (!axis) return false;
  return /(uphol|uphost|fabric|leather|hide|textile|shearling|boucl|linen|velvet|cover|cushion|seat pad)/i.test(axis);
}

/**
 * True when an axis label belongs in the swatch (soft-material) section.
 * Lampshades are fabric swatches too ("Shade", "Lampshade", "Shade Fabric"),
 * but must not widen `isUpholsteryAxisLabel`, which drives COM/upholstery logic.
 */
function isSwatchSectionAxisLabel(label: string | null | undefined): boolean {
  if (isUpholsteryAxisLabel(label)) return true;
  const axis = clean(label)?.toLowerCase();
  if (!axis) return false;
  return /\b(shade|lampshade|lamp shade)\b/.test(axis);
}


/**
 * Resolves which FinishSelector section each variant axis labels.
 *
 * Curators enter axes as Base/Top, but the semantic meaning varies: some
 * products put the wood on the base axis and the leather on the top axis
 * (e.g. Overgaard & Dyrman), others do the reverse. Assigning purely by
 * position inverted "Select Your Wood Finish" / "Select Your Upholstery
 * Finish" on those products, so classify by the label text first and fall
 * back to the positional convention.
 */
export function resolveFinishSectionLabels(input: {
  baseAxisLabel?: string | null;
  topAxisLabel?: string | null;
  baseAxisIsDimension?: boolean;
  isUpholstered?: boolean;
  woodLabelOverride?: string | null;
}): { upholsteryLabel: string | null; woodLabel: string | null } {
  const baseUsable = !!clean(input.baseAxisLabel) && !input.baseAxisIsDimension;
  const basePlaceholder = baseUsable
    ? getBasePlaceholder({ base_axis_label: input.baseAxisLabel })
    : null;
  const topPlaceholder = clean(input.topAxisLabel)
    ? getTopPlaceholder({ top_axis_label: input.topAxisLabel })
    : null;

  const baseIsUphol = baseUsable && isUpholsteryAxisLabel(input.baseAxisLabel);
  const topIsUphol = !!topPlaceholder && isUpholsteryAxisLabel(input.topAxisLabel);

  const override = clean(input.woodLabelOverride);

  // Wood on base, upholstery on top → swap out of the positional default.
  if (topIsUphol && !baseIsUphol) {
    return {
      upholsteryLabel: topPlaceholder,
      woodLabel: override || basePlaceholder,
    };
  }

  // Positional default: base labels the upholstery picker, top labels wood.
  return {
    upholsteryLabel: basePlaceholder,
    woodLabel:
      override ||
      (input.isUpholstered && topPlaceholder ? topPlaceholder : basePlaceholder),
  };
}
