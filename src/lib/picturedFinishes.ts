export interface PicturedFinishMapping {
  image_indices: number[] | null;
  category: string | null;
}

/** Suppress generic all-colourway slides, not multi-material furniture photos. */
export function picturedFinishesForImage<T extends PicturedFinishMapping>(swatches: T[], activeIndex: number | undefined, keepAll = false): T[] {
  const shown = swatches.filter((s) => s.image_indices?.includes((activeIndex ?? 0) + 1));
  const categories = new Set(shown.map((s) => (s.category || "other").trim().toLowerCase()));
  if (!keepAll && shown.length > 2 && shown.length === swatches.length && categories.size === 1) return [];
  return shown;
}
