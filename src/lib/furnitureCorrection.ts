import { resignPrivateTradeUrl } from "./privateTradeUpload";
import type { ProposalProduct } from "./proposalRenderDraft";
import { requireRoomFurnitureReferences } from "../../supabase/functions/_shared/roomFurnitureEditing";

export type CorrectionArea = { x: number; y: number; width: number; height: number };
export function correctionBounds(area: CorrectionArea, width: number, height: number) {
  if (![area.x, area.y, area.width, area.height].every(Number.isFinite) || area.x < 0 || area.y < 0 || area.width < 1 || area.height < 1 || area.x + area.width > 100 || area.y + area.height > 100) throw new Error("Mark an area around the incorrect piece.");
  const x = Math.floor(area.x * width / 100), y = Math.floor(area.y * height / 100);
  return { x, y, right: Math.min(width, Math.ceil((area.x + area.width) * width / 100)), bottom: Math.min(height, Math.ceil((area.y + area.height) * height / 100)) };
}
export function furnitureCorrectionRequest(imageUrl: string, piece: ProposalProduct, area: CorrectionArea, products: ProposalProduct[]) {
  correctionBounds(area, 100, 100);
  requireRoomFurnitureReferences(products);
  if (!products.some(p => p.id === piece.id)) throw new Error("Choose an active room piece to correct.");
  return { mode: "product_swap", imageUrl, referenceImageUrl: null, fullFrameFurnitureEdit: true,
    placements: products.map(p => ({ product_name: p.product_name, brand_name: p.brand_name, image_url: p.image_url, dimensions: p.dimensions ?? null, materials: p.materials ?? null, material_override: p.material_override ?? null, selected_finishes: p.selected_finishes ?? [] })),
    swaps: [{ imageUrl: piece.image_url,
    prompt: `Locate ONLY the incorrect furniture near x=${area.x.toFixed(2)}% to ${(area.x + area.width).toFixed(2)}%, y=${area.y.toFixed(2)}% to ${(area.y + area.height).toFixed(2)}% (origin top-left). These bounds are a location hint only, NOT a crop, mask or patch boundary. Replace that item with exactly ONE ${piece.product_name} by ${piece.brand_name} from IMAGE 2. Reproduce its exact silhouette, legs and design, not another selected chair. Dimensions: ${piece.dimensions || "unconfirmed; do not invent measurements"}. Materials: ${piece.materials || "as photographed"}. Selected finishes: ${piece.selected_finishes?.map(f => `${f.axis}: ${f.name}`).join("; ") || "as photographed"}. ${piece.material_override ? `Finish override: ${piece.material_override}.` : ""} Keep the existing position, floor contact, camera, scale and lighting. Correct only this piece and its necessary contact shadow. Do not add a duplicate, move other furniture or change architecture. Return the seamless FULL-FRAME room image.` }] };
}
/** Preserve the complete model output bytes: no canvas, crop, resizing or patch compositing. */
export async function fullFrameCorrectionImage(editedUrl: string): Promise<Blob> {
  const response = await fetch(await resignPrivateTradeUrl(editedUrl));
  if (!response.ok) throw new Error("The corrected room image could not be loaded.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("No corrected room image returned.");
  return blob;
}