import { resignPrivateTradeUrl } from "./privateTradeUpload";
import type { ProposalProduct } from "./proposalRenderDraft";
import { requireRoomFurnitureReferences } from "../../supabase/functions/_shared/roomFurnitureEditing";
import { eyeLevelShapeGuardrail } from "../../supabase/functions/_shared/eyeLevelPrompt";

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
  const guardrail = eyeLevelShapeGuardrail(piece);
  return { mode: "product_swap", imageUrl, referenceImageUrl: null, fullFrameFurnitureEdit: true, singleItemReferenceReplacement: true,
    placements: products.map(p => ({ product_id: p.product_id ?? null, product_name: p.product_name, brand_name: p.brand_name, image_url: p.image_url, dimensions: p.dimensions ?? null, materials: p.materials ?? null, material_override: p.material_override ?? null, selected_finishes: p.selected_finishes ?? [] })),
    swaps: [{ imageUrl: piece.image_url, productId: piece.product_id ?? null, productName: piece.product_name,
    prompt: `Locate ONLY the incorrect furniture near x=${area.x.toFixed(2)}% to ${(area.x + area.width).toFixed(2)}%, y=${area.y.toFixed(2)}% to ${(area.y + area.height).toFixed(2)}% (origin top-left). These bounds are a location hint only, NOT a crop, mask or patch boundary. COMPLETELY ERASE the existing item at that location (including its wrong or stretched silhouette and shadow) down to clean floor, and render ONE brand-new ${piece.product_name} by ${piece.brand_name} from scratch using IMAGE 2 and any labelled additional angle photos — do NOT trace or keep the old stretched outline from IMAGE 1. Reproduce its exact 3D footprint geometry, corners, legs and design — never substitute another piece or stretch one axis. ${guardrail} Materials: ${piece.materials || "as photographed"}. Selected finishes: ${piece.selected_finishes?.map(f => `${f.axis}: ${f.name}`).join("; ") || "as photographed"}. ${piece.material_override ? `Finish override: ${piece.material_override}.` : ""} Keep the exact room aspect ratio, camera, surrounding furniture, floor level and daylight unchanged. Correct only this piece and its necessary contact shadow. Return the seamless FULL-FRAME room image.` }] };
}
export function furnitureRemovalRequest(imageUrl: string, piece: ProposalProduct, area: CorrectionArea, products: ProposalProduct[]) {
  correctionBounds(area, 100, 100);
  if (!products.some(p => p.id === piece.id)) throw new Error("Choose an active room piece to remove.");
  const remaining = products.filter(p => p.id !== piece.id);
  if (remaining.length) requireRoomFurnitureReferences(remaining);
  return {
    mode: "proposal_refine", imageUrl, referenceImageUrl: null,
    placements: remaining.map(p => ({ product_id: p.product_id ?? null, product_name: p.product_name, brand_name: p.brand_name, image_url: p.image_url, dimensions: p.dimensions ?? null, materials: p.materials ?? null, material_override: p.material_override ?? null, selected_finishes: p.selected_finishes ?? [] })),
    markerHints: { remove_points: [{ x_percent: area.x + area.width / 2, y_percent: area.y + area.height / 2, label: piece.product_name }] },
    refinementPrompt: `REMOVE ONLY ONE INSTANCE of ${piece.product_name} by ${piece.brand_name} inside x=${area.x}% to ${area.x + area.width}%, y=${area.y}% to ${area.y + area.height}% (origin top-left). Erase the complete object and its own contact shadow/reflection; reconstruct the previously hidden floor/wall naturally. Do not add a replacement. If an identical piece exists elsewhere, KEEP that other instance exactly unchanged. These bounds identify the object, NOT a rectangular patch or crop. Preserve all other furniture, materials, architecture, camera, lens, framing, daylight, exposure and the exact image aspect ratio. Return one seamless FULL-FRAME room image.`,
  };
}
/** Preserve the complete model output bytes: no canvas, crop, resizing or patch compositing. */
export async function fullFrameCorrectionImage(editedUrl: string): Promise<Blob> {
  const response = await fetch(await resignPrivateTradeUrl(editedUrl));
  if (!response.ok) throw new Error("The corrected room image could not be loaded.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("No corrected room image returned.");
  return blob;
}