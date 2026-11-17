import type { MoodRoomType } from "./moodBoardBudget";
import type { SharedRoomLayout } from "./sharedRoomLayout";
import { layoutSpatialItems, spatialLayoutBounds } from "./spatialLayoutEngine";

type Piece = { id: string; product_name: string; glb_url: string | null; retailCents: number | null; image_url?: string | null; brand_name?: string; dimensions?: string | null; width_mm?: number | null; depth_mm?: number | null; height_mm?: number | null; size_variants?: Array<{ label?: string | null; base?: string | null; top?: string | null }> | null; category?: string | null; subcategory?: string | null; specItemId?: string | null; appearance?: import("@/types/aiCuratedScene").PieceAppearance };
/** Pack exact selections into a measured vignette; never drop unpriced/model-less pieces. */
export function moodBoardHandoff(pieces: Piece[], projectId: string | null, roomType: MoodRoomType, previous: SharedRoomLayout | null, updatedAt: number, budgetEur: number | null = previous?.budgetEur ?? null, anchorId: string | null = null): SharedRoomLayout {
  const placements = layoutSpatialItems(pieces, anchorId);
  const bounds = spatialLayoutBounds(placements);
  return {
    projectId, source: "mood-board", roomType, budgetEur, updatedAt,
    anchorId: placements[0]?.item.id ?? null,
    room: { width: Math.max(previous?.room.width ?? 7.2, bounds.width + 1.6), length: Math.max(previous?.room.length ?? 6, bounds.depth + 1.6), height: previous?.room.height ?? 3.2 },
    wallFinish: previous?.wallFinish, floorFinish: previous?.floorFinish,
    items: placements.map(({ item, x, z, rotationY }) => ({ productId: item.id, name: item.product_name, glbUrl: item.glb_url,
      imageUrl: item.image_url, brandName: item.brand_name, dimensions: item.dimensions,
      width_mm: item.width_mm, depth_mm: item.depth_mm, height_mm: item.height_mm, size_variants: item.size_variants,
      category: item.category, subcategory: item.subcategory, specItemId: item.specItemId,
      x, z, rotationY,
      priceEur: item.retailCents == null ? null : item.retailCents / 100, ...(item.appearance ? { appearance: item.appearance } : {}) })),
  };
}
