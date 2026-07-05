/**
 * Decide whether a quote line should render a dedicated "Wood finish: X"
 * row (on-screen and in the PDF) or suppress it because the same swatch
 * is already reflected in the variant label / resolved finish swatches.
 *
 * Historical bug: for metal items (e.g. Socle Table Lamp) the metal finish
 * was stored in `wood_fabric_id`, causing "Wood finish: Light Bronze Medal
 * 0922" to appear even though the same swatch was already shown under
 * "Selected finishes". This helper is the single source of truth so the
 * regression can't sneak back into either the UI or the PDF pipeline.
 */
export interface WoodFinishSwatch {
  name?: string | null;
}

export function resolveWoodFinishLabel(
  wood: WoodFinishSwatch | null | undefined,
  variantLabel: string | null | undefined,
  variantSwatches: ReadonlyArray<{ name?: string | null }> = [],
): string | null {
  const woodName = wood?.name ? String(wood.name).trim() : "";
  if (!woodName) return null;

  const woodLc = woodName.toLowerCase();
  const variantLc = (variantLabel || "").toLowerCase();
  const swatchNamesLc = variantSwatches
    .map((s) => (s?.name || "").toLowerCase())
    .filter(Boolean);

  const alreadyShown =
    variantLc.includes(woodLc) ||
    swatchNamesLc.some(
      (n) => n === woodLc || n.includes(woodLc) || woodLc.includes(n),
    );

  return alreadyShown ? null : `Wood finish: ${woodName}`;
}
