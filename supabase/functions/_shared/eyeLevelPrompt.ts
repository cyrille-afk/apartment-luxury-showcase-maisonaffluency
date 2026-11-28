import { validEyeLevelCamera, EYE_LEVEL_HEIGHT_M, EYE_LEVEL_LENS_MM, type EyeLevelCamera } from "./eyeLevelCamera.ts";

export function eyeLevelShellPrompt(camera: EyeLevelCamera): string {
  if (!validEyeLevelCamera(camera)) throw new Error("Place the camera and sightline at different points inside the plan.");
  return `Generate ONE photorealistic EMPTY interior architectural photograph from the supplied top-down plan.
CAMERA: image coordinates are percentages, origin top-left; x increases right, y increases down.
Stand at (${camera.position.x.toFixed(2)}%, ${camera.position.y.toFixed(2)}%) and look toward (${camera.target.x.toFixed(2)}%, ${camera.target.y.toFixed(2)}%). These are image-space room locations, NOT compass headings or metres.
Camera height exactly ${EYE_LEVEL_HEIGHT_M}m above the floor; ${EYE_LEVEL_LENS_MM}mm full-frame wide-angle lens, horizontal optical axis, straight verticals, realistic perspective. Frame only the room containing the camera, looking along the indicated sightline.
IMAGE 1 is the architectural authority. Preserve that room's exact footprint, curved bay windows, glazing rhythm, openings, doors, built-ins, floor material and daylight direction where visible. IMAGE 2, when provided, is the original floor plan for verifying architecture, not a camera reference. Restore enclosing walls and ceiling omitted solely by the cutaway convention; do not redesign the room or invent an exterior skyline. Unshown details should be restrained, not elaborate invented architecture.
REMOVE all movable furniture, rugs, decor, plants and artwork. Keep fixed architecture only, realistic material texture, reflections and natural daylight through the recorded windows. No furniture from any reference may enter the shell.
Output one immersive edge-to-edge EYE-LEVEL interior photograph. No axonometric, overhead, dollhouse, inset plan, camera pin, arrow, text, watermark or drafting border.`;
}

export type EyeLevelPlacement = { product_name: string; brand_name?: string; dimensions?: string | null; materials?: string | null; material_override?: string | null; room_section?: string | null; selected_finishes?: { axis: string; name: string; image_url?: string | null }[] };
export function eyeLevelStagingPrompt(placements: EyeLevelPlacement[]): string {
  if (!placements.length || placements.length > 10) throw new Error("Select between 1 and 10 products.");
  return `Stage the client's EXACT collectible furniture inside the EMPTY EYE-LEVEL SHELL.
IMAGE ORDER: 1 = empty eye-level shell (PRIMARY image and absolute camera/architecture authority); 2 = original top-down furnished layout (furniture zones ONLY, never camera or product appearance); next ${placements.length} images = product photos in the numbered order below; subsequent labelled images = selected finish swatches.
${placements.map((p, i) => `${i + 1}. ${p.product_name} by ${p.brand_name || "recorded maker"}; dimensions: ${p.dimensions || "unconfirmed — do not invent measurements"}; zone: ${p.room_section || "corresponding furniture type in layout"}; recorded materials: ${p.materials || "as photographed"}; selected finishes: ${(p.selected_finishes || []).map(f => `${f.axis}: ${f.name}`).join("; ") || "as photographed"}${p.material_override ? `; explicit finish override: ${p.material_override}` : ""}`).join("\n")}
Preserve IMAGE 1's exact 1.5m eye-level camera, 24mm wide-angle perspective, crop, walls, bay-window curvature, floor, ceiling, daylight and architecture. NEVER use the overhead reference camera.
Reproduce each product's exact silhouette, geometry, legs, edge profiles and design from its product photo, not an approximate substitute. Change only the specified finish axes, using their swatches; unspecified axes stay as photographed. Keep independent seat/backrest/frame/top materials distinct. Respect recorded dimensions and plausible scale, floor contact, natural perspective, contact shadows and reflections.
Map visible selected furniture to matching zones in the top-down layout, with natural spacing and no overlaps. Pieces outside the camera's field of view remain outside it; do not widen the room or move every room's furniture into this shot to show it all. Do not add unselected furniture, accessories or rugs. Do not copy reference furniture designs. Output ONE photorealistic interior photograph, no plan inset, annotations, labels or watermark.`;
}