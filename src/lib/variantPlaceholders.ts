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
  let lower = formatVariantAxisLabel(label)!.toLowerCase();
  if (lower === "size") return "Select Your Size";
  // Fix common DB truncations: "fini" → "finish"
  lower = lower.replace(/\bfini\b/g, "finish");
  // Append "finish" unless the label already ends with a noun that wouldn't pair with "finish"
  const skipSuffix = /\b(finish|fabric|material|size|colour|color|leather|diffuser|shade|model|version|variant|option)$/i.test(lower);
  return skipSuffix ? `Select your ${lower}` : `Select your ${lower} finish`;
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
