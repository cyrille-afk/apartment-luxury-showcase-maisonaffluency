import { eyeLevelShapeGuardrail } from "./eyeLevelPrompt.ts";

export type RoomFurnitureReference = {
  id?: string; category_role?: string; width_m?: number; depth_m?: number; height_m?: number;
  product_id?: string | null; product_name: string; brand_name?: string; image_url: string;
  secondary_image_urls?: string[];
  /** Browser-resized studio photo (data URL); preferred over image_url when present. */
  reference_image_data?: string | null;
  dimensions?: string | null; materials?: string | null; material_override?: string | null;
  selected_finishes?: { axis: string; name: string; image_url?: string | null }[];
};

const NON_PRODUCT_PHOTO = /(?:^|[/._-])(logo|wordmark|badge|brand[-_]?mark|screen[_ -]?shot)(?:[/._-]|$)/i;

export function normalizeSecondaryReferenceUrl(url: string): string {
  // Pad Cloudinary secondary angle shots into a 1:1 square so portrait/landscape gallery photos
  // never bias the image generator into flipping the room's aspect ratio.
  if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?!c_pad,)/i.test(url)) {
    return url.replace(/(\/image\/upload\/)/i, "$1c_pad,w_1024,h_1024,b_white/");
  }
  return url;
}

export function selectSecondaryReferencePhotos(primaryUrl: string, galleryImages: unknown, maxCount = 2): string[] {
  if (!Array.isArray(galleryImages) || maxCount <= 0) return [];
  const seen = new Set<string>([primaryUrl.trim()]);
  const results: string[] = [];
  for (const item of galleryImages) {
    if (typeof item !== "string") continue;
    const url = item.trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    const pathPart = url.split(/[?#]/)[0] || url;
    if (NON_PRODUCT_PHOTO.test(pathPart)) continue;
    seen.add(url);
    results.push(normalizeSecondaryReferenceUrl(url));
    if (results.length >= maxCount) break;
  }
  return results;
}

export function requireRoomFurnitureReferences(pieces: RoomFurnitureReference[]) {
  if (!Array.isArray(pieces) || !pieces.length || pieces.length > 10 || pieces.some(p => !p?.product_name || !p.image_url)) {
    throw new Error("Every active room piece needs its reference photo (1–10 pieces).");
  }
}

export function roomFurnitureReferenceText(pieces: RoomFurnitureReference[]) {
  return pieces.map((p, i) => `${i + 1}. ${p.product_name} by ${p.brand_name || "recorded maker"}; ${eyeLevelShapeGuardrail(p)}; recorded materials: ${p.materials || "as photographed"}; selected finishes: ${p.selected_finishes?.map(f => `${f.axis}: ${f.name}`).join("; ") || "as photographed"}${p.material_override ? `; explicit finish override: ${p.material_override}` : ""}`).join("\n");
}

export function fullFrameFurnitureLock(pieces: RoomFurnitureReference[], targetProductNames: string[] = []) {
  const riftPiece = pieces.find(p => /\brift\s+cts\b/i.test(p.product_name));
  const riftTargeted = targetProductNames.some(name => /\brift\s+cts\b/i.test(name));
  const riftClause = !riftPiece ? "" : riftTargeted
    ? ` Rift CTS IS the explicit target of this correction: the center table currently in IMAGE 1 is WRONG (it is stretched into an elongated oval). COMPLETELY ERASE that elongated oval table and its shadow down to clean marble floor, then rebuild a brand-new 1:1 rounded-square (squircle) Rift CTS table from scratch matching ${eyeLevelShapeGuardrail(riftPiece)} and the provided angle photos — with four distinct softly bowed sides and four broad rounded corners, equal width and depth in floor perspective — while keeping every surrounding chair, window, kitchen and the exact aspect ratio of IMAGE 1 100% unchanged.`
    : " Specifically keep the exact silhouette, carved stone slab and wood legs of the Rift CTS Coffee Table unchanged. Moving it changes its position ONLY, never its geometry, slab, legs, proportions or materials. Never replace it with a generic table or stretch its footprint.";
  return `FULL-FRAME SEAMLESS EDIT: IMAGE 1 is the entire current room image, not a cropped patch. Return ONE complete image at the identical framing and aspect ratio. Never crop a rectangular region, paste a patch, create a rectangular cutout, or leave a seam across windows, adjacent pieces or reflections. No inpainting mask is supplied; the marked coordinates identify the target only, not a rectangular edit boundary.
Keep the entire architectural shell, window mullions, bay view, marble floor reflections, and all other furniture pieces 100% identical; replace ONLY the explicitly specified target item with the specified new item and selected finish, matching the exact natural daylight direction and floor shadows.
Preserve 100% of the architecture, window mullions, flooring, and all non-swapped furniture pieces exactly as they appear. Modify ONLY the target item specified and its physically necessary contact shadow/reflection. Keep the original camera, lens, positions, sizes, occlusions, colour balance and exposure. Product references are visual ground truth, NEVER permission to restage non-target pieces or reapply their finishes.${riftClause}
ALL ACTIVE ROOM PRODUCTS (labelled reference images follow; preserve every non-target design, silhouette and existing finish):
${roomFurnitureReferenceText(pieces)}`;
}

export function proposalRefinementLock(pieces: RoomFurnitureReference[]) {
  return `IMMUTABLE BASE RENDER & PRODUCT REFERENCE LOCK: IMAGE 1 is the CURRENT ACTIVE furnished render and the sole architectural/camera authority, not a new room to generate. IMAGE 2 onward are the original high-resolution studio photographs of EVERY placed catalogue instance, followed by labelled selected swatches and angles. These are identity checks, never permission to restage the room.
Preserve 100% of the walls, windows, terrace door, kitchen opening, flooring, and all non-moved furniture pieces pixel-for-pixel. Apply ONLY the requested position/refinement change without redesigning any furniture silhouette.
MOVE: relocate ONLY the marked instance from source to destination. Retain its exact sculptural silhouette, proportions, carved details, legs, joinery and current materials; do not replace, rebuild or reinterpret it. Other instances of the same product stay untouched.
REMOVE: erase ONLY each marked instance and its necessary contact shadow/reflection. Reveal the immediately surrounding existing background naturally. A removed product reference identifies what to erase, NOT a piece to reinsert elsewhere. Preserve every remaining instance.
REFINE: apply ONLY the explicit request to the target, preserving its authentic catalogue geometry. Never turn Rift CTS into an oval bowl, pedestal or generic table: retain its carved stone slab and wood legs. Retain the original armchair frames/upholstery and Yoma Console joinery. Unspecified finishes and non-target pieces stay exactly as IMAGE 1 shows.
Keep the exact full-frame crop, aspect ratio, camera, daylight, exposure, window/door edges and kitchen opening. Do not copy architecture from a plan, relight, add décor or reinterpret materials. Change only the target and physically necessary shadows/reflections; return one seamless complete image without overlays or pasted rectangular patches.
PLACED CATALOGUE IDENTITIES:
${roomFurnitureReferenceText(pieces)}`;
}

export function roomFurnitureReferenceImages(pieces: RoomFurnitureReference[], excludeProductNames: string[] = []) {
  requireRoomFurnitureReferences(pieces);
  const excluded = new Set(excludeProductNames.map(n => n.trim().toLowerCase()).filter(Boolean));
  return pieces.flatMap((p, i) => excluded.has(p.product_name.trim().toLowerCase()) ? [] : [
    { type: "text", text: `Active room product ${i + 1}: ${p.product_name}. Preserve as shown in IMAGE 1 unless explicitly targeted.` },
    { type: "image_url", image_url: { url: p.image_url } },
  ]);
}