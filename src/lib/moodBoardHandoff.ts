import type { MoodRoomType } from "./moodBoardBudget";
import type { SharedRoomLayout } from "./sharedRoomLayout";

type Piece = { id: string; product_name: string; glb_url: string | null; retailCents: number | null; image_url?: string | null; brand_name?: string; dimensions?: string | null; width_mm?: number | null; depth_mm?: number | null };
/** Pack exact selections in dimensioned rows; never drop unpriced/model-less pieces. */
export function moodBoardHandoff(pieces: Piece[], projectId: string | null, roomType: MoodRoomType, previous: SharedRoomLayout | null, updatedAt: number, budgetEur: number | null = previous?.budgetEur ?? null): SharedRoomLayout {
  const widths = pieces.map(p => Math.max(.4, (p.width_mm ?? 1200) / 1000));
  const depths = pieces.map(p => Math.max(.4, (p.depth_mm ?? 1000) / 1000));
  const columns = Math.max(1, Math.ceil(Math.sqrt(pieces.length)));
  const cellW = Math.max(1.8, ...widths) + .6, cellD = Math.max(1.5, ...depths) + .6;
  const rows = Math.ceil(pieces.length / columns);
  return {
    projectId, source: "mood-board", roomType, budgetEur, updatedAt,
    room: { width: Math.max(previous?.room.width ?? 7.2, columns * cellW + .8), length: Math.max(previous?.room.length ?? 6, rows * cellD + .8), height: previous?.room.height ?? 3.2 },
    wallFinish: previous?.wallFinish, floorFinish: previous?.floorFinish,
    items: pieces.map((p, i) => ({ productId: p.id, name: p.product_name, glbUrl: p.glb_url,
      imageUrl: p.image_url, brandName: p.brand_name, dimensions: p.dimensions,
      x: (i % columns - (columns - 1) / 2) * cellW, z: (Math.floor(i / columns) - (rows - 1) / 2) * cellD,
      rotationY: roomType === "living" && /chair|sofa|seat/i.test(p.product_name) && Math.floor(i / columns) >= rows / 2 ? Math.PI : 0,
      priceEur: p.retailCents == null ? null : p.retailCents / 100 })),
  };
}