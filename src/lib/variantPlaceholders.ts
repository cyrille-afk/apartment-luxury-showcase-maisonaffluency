/**
 * Shared logic for variant dropdown placeholders.
 *
 * Rule (matches the admin preview panel):
 * - If `variant_placeholder` is set, it overrides BOTH Base and Top dropdowns.
 * - Otherwise, fall back to the axis-label template:
 *     "Select your {base_axis_label || 'base'} choice"
 *     "Select your {top_axis_label  || 'top'}  choice"
 */

export interface VariantPlaceholderInput {
  variant_placeholder?: string | null;
  base_axis_label?: string | null;
  top_axis_label?: string | null;
}

export function getBasePlaceholder(p: VariantPlaceholderInput): string {
  return (
    p.variant_placeholder ||
    `Select your ${(p.base_axis_label || "base").toLowerCase()} choice`
  );
}

export function getTopPlaceholder(p: VariantPlaceholderInput): string {
  return (
    p.variant_placeholder ||
    `Select your ${(p.top_axis_label || "top").toLowerCase()} choice`
  );
}

/** Default placeholder for non-dual-axis material/size dropdowns. */
export function getMaterialPlaceholder(p: VariantPlaceholderInput): string {
  return p.variant_placeholder || "Select your material choice";
}
