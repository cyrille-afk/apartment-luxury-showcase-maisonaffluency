/**
 * Splits FinishSelector photo events into two pools:
 * - hover (uncommitted) → `hoveredPreviewIndex`, main viewport only;
 * - click (committed)   → `permanentIndex`, drives Felix/inventory snapshots.
 * Hover can never write the permanent pool.
 */
export interface SwatchImageMeta { committed?: boolean; restore?: boolean }

export interface SwatchImageUpdate {
  /** 0-based permanent photo index; undefined = leave unchanged. */
  permanentIndex?: number;
  /** 0-based hover preview index; null clears the preview. */
  hoveredPreviewIndex: number | null;
}

export function resolveSwatchImageEvent(indices: number[] | null | undefined, meta?: SwatchImageMeta): SwatchImageUpdate {
  const first = indices?.length ? Math.max(0, indices[0] - 1) : null;
  if (meta?.committed) return first === null ? { hoveredPreviewIndex: null } : { permanentIndex: first, hoveredPreviewIndex: null };
  if (meta?.restore || first === null) return { hoveredPreviewIndex: null };
  return { hoveredPreviewIndex: first };
}
