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
const DEFAULT_MATERIAL_PLACEHOLDER = "Select your material choice";

/** Returns the input string trimmed, or null if empty/whitespace/nullish. */
function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function placeholderFromAxisLabel(label: string): string {
  return `Select your ${label.toLowerCase()} choice`;
}

export function getBasePlaceholder(p: VariantPlaceholderInput): string {
  // Axis-specific labels take precedence in dual-axis mode so each dropdown
  // reads as its own dimension (e.g. "Select your solid-cast textured legs choice")
  // rather than both dropdowns inheriting the same generic override.
  const axis = clean(p.base_axis_label);
  if (axis) return placeholderFromAxisLabel(axis);

  const override = clean(p.variant_placeholder);
  if (override) return override;

  return DEFAULT_BASE_PLACEHOLDER;
}

export function getTopPlaceholder(p: VariantPlaceholderInput): string {
  const axis = clean(p.top_axis_label);
  if (axis) return placeholderFromAxisLabel(axis);

  const override = clean(p.variant_placeholder);
  if (override) return override;

  return DEFAULT_TOP_PLACEHOLDER;
}

/** Default placeholder for non-dual-axis material/size dropdowns. */
export function getMaterialPlaceholder(p: VariantPlaceholderInput): string {
  return clean(p.variant_placeholder) || DEFAULT_MATERIAL_PLACEHOLDER;
}
