/**
 * Shared logic for variant dropdown placeholders.
 *
 * Resolution order for Base / Top dropdowns:
 *   1. `variant_placeholder` (curator override) — applied to BOTH dropdowns when set.
 *   2. Axis-specific label → "Select your {label} choice"
 *      (e.g. "Plinth" → "Select your plinth choice")
 *   3. Generic per-axis default — Base: "Select your base finish",
 *                                 Top:  "Select your top finish".
 *      We avoid the meta-words "base"/"top" alone (e.g. "Select your base choice")
 *      because they read awkwardly to end users; "finish" reads naturally for
 *      furniture/lighting variants which is the dominant use case.
 *
 * All string inputs are trimmed and treated as missing if empty/whitespace.
 */

export interface VariantPlaceholderInput {
  variant_placeholder?: string | null;
  base_axis_label?: string | null;
  top_axis_label?: string | null;
}

const DEFAULT_BASE_PLACEHOLDER = "Select your base finish";
const DEFAULT_TOP_PLACEHOLDER = "Select your top finish";
const DEFAULT_MATERIAL_PLACEHOLDER = "Select your finish";

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

function placeholderFromAxisLabel(label: string): string {
  return `Select your ${formatVariantAxisLabel(label)!.toLowerCase()}`;
}

export function getBasePlaceholder(p: VariantPlaceholderInput): string {
  // Axis-specific label wins when set — it reads naturally per dropdown
  // (e.g. "Select your frame choice"). Fall back to the curator override
  // (which applies to both dropdowns) only when no axis label is defined,
  // then to the generic default.
  const axis = formatVariantAxisLabel(p.base_axis_label);
  if (axis) return placeholderFromAxisLabel(axis);

  const override = clean(p.variant_placeholder);
  if (override) return override;

  return DEFAULT_BASE_PLACEHOLDER;
}

export function getTopPlaceholder(p: VariantPlaceholderInput): string {
  const axis = formatVariantAxisLabel(p.top_axis_label);
  if (axis) return placeholderFromAxisLabel(axis);

  const override = clean(p.variant_placeholder);
  if (override) return override;

  return DEFAULT_TOP_PLACEHOLDER;
}


/** Default placeholder for non-dual-axis material/size dropdowns. */
export function getMaterialPlaceholder(p: VariantPlaceholderInput): string {
  return clean(p.variant_placeholder) || DEFAULT_MATERIAL_PLACEHOLDER;
}
