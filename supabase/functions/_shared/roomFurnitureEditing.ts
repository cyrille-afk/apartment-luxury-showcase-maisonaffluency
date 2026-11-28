import { eyeLevelShapeGuardrail } from "./eyeLevelPrompt.ts";

export type RoomFurnitureReference = {
  product_name: string; brand_name?: string; image_url: string;
  dimensions?: string | null; materials?: string | null; material_override?: string | null;
  selected_finishes?: { axis: string; name: string; image_url?: string | null }[];
};

export function requireRoomFurnitureReferences(pieces: RoomFurnitureReference[]) {
  if (!Array.isArray(pieces) || !pieces.length || pieces.length > 10 || pieces.some(p => !p?.product_name || !p.image_url)) {
    throw new Error("Every active room piece needs its reference photo (1–10 pieces).");
  }
}

export function roomFurnitureReferenceText(pieces: RoomFurnitureReference[]) {
  return pieces.map((p, i) => `${i + 1}. ${p.product_name} by ${p.brand_name || "recorded maker"}; ${eyeLevelShapeGuardrail(p)}; recorded materials: ${p.materials || "as photographed"}; selected finishes: ${p.selected_finishes?.map(f => `${f.axis}: ${f.name}`).join("; ") || "as photographed"}${p.material_override ? `; explicit finish override: ${p.material_override}` : ""}`).join("\n");
}

export function fullFrameFurnitureLock(pieces: RoomFurnitureReference[]) {
  return `FULL-FRAME SEAMLESS EDIT: IMAGE 1 is the entire current room image, not a cropped patch. Return ONE complete image at the identical framing and aspect ratio. Never crop a rectangular region, paste a patch, create a rectangular cutout, or leave a seam across windows, adjacent pieces or reflections. No inpainting mask is supplied; the marked coordinates identify the target only, not a rectangular edit boundary.
Keep the entire architectural shell, window mullions, bay view, marble floor reflections, and all other furniture pieces 100% identical; replace ONLY the explicitly specified target item with the specified new item and selected finish, matching the exact natural daylight direction and floor shadows.
Preserve 100% of the architecture, window mullions, flooring, and all non-swapped furniture pieces exactly as they appear. Modify ONLY the target item specified and its physically necessary contact shadow/reflection. Keep the original camera, lens, positions, sizes, occlusions, colour balance and exposure. Product references are visual ground truth, NEVER permission to restage non-target pieces or reapply their finishes.${pieces.some(p => /\brift\s+cts\b/i.test(p.product_name)) ? " Specifically keep the exact silhouette, carved stone base, and wood top of the center Rift CTS Coffee Table unchanged unless Rift CTS itself is the explicit target. Never replace it with a generic table, change its top/base materials or stretch its footprint." : ""}
ALL ACTIVE ROOM PRODUCTS (labelled reference images follow; preserve every non-target design, silhouette and existing finish):
${roomFurnitureReferenceText(pieces)}`;
}

export function roomFurnitureReferenceImages(pieces: RoomFurnitureReference[]) {
  requireRoomFurnitureReferences(pieces);
  return pieces.flatMap((p, i) => [
    { type: "text", text: `Active room product ${i + 1}: ${p.product_name}. Preserve as shown in IMAGE 1 unless explicitly targeted.` },
    { type: "image_url", image_url: { url: p.image_url } },
  ]);
}