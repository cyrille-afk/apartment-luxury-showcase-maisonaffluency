/**
 * Normalize a designer/brand name for display on product pages.
 *
 * - Drops the trailing "Studio" suffix (e.g. "Apparatus Studio" → "Apparatus").
 * - Splits on " - " and keeps the first part when a display alias is encoded.
 */
export function formatDesignerDisplayName(name: string | null | undefined): string {
  if (!name) return "";
  const base = name.includes(" - ")
    ? name.split(" - ")[0].trim()
    : name;
  return base.replace(/\s+Studio$/i, "");
}
