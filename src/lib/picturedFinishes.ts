export interface PicturedFinishMapping {
  image_indices: number[] | null;
  category: string | null;
}

/** Pick the most finish-specific valid photo, avoiding shared colourway slides. */
export function finishPhotoIndex<T extends PicturedFinishMapping>(finish: T, swatches: T[], imageCount: number): number | undefined {
  const indices = (finish.image_indices || []).filter((index) => Number.isInteger(index) && index > 0 && index <= imageCount);
  let best: number | undefined;
  let fewest = Infinity;
  for (const index of indices) {
    const count = swatches.filter((swatch) => swatch.image_indices?.includes(index)).length;
    if (count < fewest) {
      best = index - 1;
      fewest = count;
    }
  }
  return best;
}

/** Suppress generic all-colourway slides, not multi-material furniture photos. */
export function picturedFinishesForImage<T extends PicturedFinishMapping>(swatches: T[], activeIndex: number | undefined, keepAll = false): T[] {
  const shown = swatches.filter((s) => s.image_indices?.includes((activeIndex ?? 0) + 1));
  const categories = new Set(shown.map((s) => (s.category || "other").trim().toLowerCase()));
  if (!keepAll && shown.length > 2 && shown.length === swatches.length && categories.size === 1) return [];
  return shown;
}
