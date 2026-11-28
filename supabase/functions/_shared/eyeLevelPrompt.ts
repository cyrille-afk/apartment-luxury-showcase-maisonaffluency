import { validEyeLevelCamera, EYE_LEVEL_HEIGHT_M, EYE_LEVEL_LENS_MM, type EyeLevelCamera } from "./eyeLevelCamera.ts";
import { requireEyeLevelTargets, validEyeLevelTarget, type EyeLevelTarget } from "./eyeLevelPlacement.ts";
import { roomArchitectureConstraint, type RoomType } from "./roomZone.ts";
import { isEyeLevelSurface, surfaceStagingInstruction, type SurfaceProduct } from "./eyeLevelSurfaces.ts";

// Normalize only recorded measurements; never infer missing axes from a photo.
export function eyeLevelMetricDimensions(text?: string | null) {
  if (!text) return null;
  const number = "([0-9]+(?:\\.[0-9]+)?)";
  const unit = "(mm|cm|m|inches|inch|in|\")?";
  const sharedUnit = text.match(/\b(mm|cm|m|inches|inch|in)\b|"/i)?.[0]?.toLowerCase() ?? "cm";
  const convert = (value: string, recordedUnit: string | undefined) => {
    const n = Number(value);
    const u = recordedUnit?.toLowerCase() || sharedUnit;
    return Number((n * (u === "mm" ? 0.1 : u === "m" ? 100 : ["inches", "inch", "in", '"'].includes(u) ? 2.54 : 1)).toPrecision(12));
  };
  const axis = (label: string) => {
    const match = text.match(new RegExp(`(?:^|[^a-z])${label}\\s*[:=]?\\s*${number}\\s*${unit}(?![a-z])`, "i"));
    return match?.[1] ? convert(match[1], match[2]) : null;
  };
  const triple = text.match(new RegExp(`${number}\\s*${unit}\\s*[×x*]\\s*${number}\\s*${unit}\\s*[×x*]\\s*H?\\s*${number}\\s*${unit}`, "i"));
  const w = axis("W") ?? (triple?.[1] ? convert(triple[1], triple[2]) : null);
  const d = axis("D") ?? (triple?.[3] ? convert(triple[3], triple[4]) : null);
  const h = axis("H") ?? (triple?.[5] ? convert(triple[5], triple[6]) : null);
  if (w === null || d === null || h === null || ![w, d, h].every(n => Number.isFinite(n) && n > 0)) return null;
  return { w, d, h, footprintRatio: w / d, seatHeight: axis("SH") };
}

export function eyeLevelShapeGuardrail(piece: { product_name: string; dimensions?: string | null }) {
  const metric = eyeLevelMetricDimensions(piece.dimensions);
  const size = metric ? `EXACT METRIC SIZE: width ${metric.w} × depth ${metric.d} × height ${metric.h} cm; true ground-plane W:D ratio ${metric.footprintRatio.toFixed(4)}:1${metric.seatHeight !== null ? `; recorded seat-cushion height ${metric.seatHeight} cm` : ""}` : `dimensions unconfirmed: ${piece.dimensions || "not recorded"}; do not invent missing measurements`;
  const rift = /\brift\s+cts\b/i.test(piece.product_name);
  const riftSquare = rift && metric !== null && Math.abs(metric.footprintRatio - 1) <= 0.08;
  const riftRule = riftSquare
    ? " Rift CTS is a 1:1 rounded-square (squircle) coffee table — equal width and depth with FOUR distinctly straight-to-softly-bowed sides and FOUR broad rounded corners (a cushion-square / superellipse plan), NEVER an elongated oval, NEVER a racetrack/capsule, and NEVER a plain circle. In floor perspective its front-to-back depth must look unmistakably square-proportioned (matching its left-to-right width) with visible rounded corners, carved travertine bowl shell, inset oak top with paired square timber tenons, and recessed oak block legs strictly faithful to the reference photos; its exact 1:1 W:D ratio above is authoritative."
    : rift
      ? " Rift CTS is a compact rounded-square (squircle) coffee table with four softly bowed sides and broad rounded corners — NEVER stretch it into a long elongated oval; its exact selected W:D ratio above is authoritative."
      : "";
  return `${size}. SHAPE LOCK: preserve this item's photographed silhouette, footprint aspect ratio, top thickness, legs and base; perspective may foreshorten the footprint but must NEVER deform its geometry or stretch one axis independently.${riftRule}`;
}

export const EYE_LEVEL_SHELL_ARCHITECTURE_LOCK = `IMAGE 1 is the sole architectural authority. Preserve its exact footprint, floor material, built-ins and daylight direction. When IMAGE 1 shows ONE CONTINUOUS CURVED BAY wrapping the front and right, preserve exactly that single uninterrupted curved bay, including its curve, glazing rhythm and mullions; it is the ONLY window system in the room. Never split it into separate windows, straighten it, or add a second window system on the left or any other wall. Existing doors and openings visible in IMAGE 1 stay exactly where they are. DO NOT ADD ANY WINDOWS, DOORS, BALCONY DOORS, BALCONIES OR OTHER OPENINGS anywhere, including on reconstructed or unseen walls. Restore walls and ceiling omitted solely by the cutaway convention as continuous solid surfaces with no new openings. Never infer extra openings from symmetry, conventional apartment layouts, exterior views or ambiguous plan marks. Do not redesign the room, expand beyond the crop or invent an exterior skyline.`;

export function eyeLevelShellPrompt(camera: EyeLevelCamera, roomType?: RoomType): string {
  if (!validEyeLevelCamera(camera)) throw new Error("Place the camera and sightline at different points inside the plan.");
  return `Generate ONE photorealistic EMPTY interior architectural photograph from the supplied top-down plan.
${roomType ? roomArchitectureConstraint(roomType) : ""}
CAMERA: image coordinates are percentages, origin top-left; x increases right, y increases down.
The final labelled CAMERA DIRECTION GUIDE, when supplied, shows the same room crop with a camera dot and an arrow: stand at the dot and face the arrow tip. Use it only to resolve camera location and direction; never copy its annotations into the photograph.
Stand at (${camera.position.x.toFixed(2)}%, ${camera.position.y.toFixed(2)}%) and look toward (${camera.target.x.toFixed(2)}%, ${camera.target.y.toFixed(2)}%). These are image-space room locations, NOT compass headings or metres.
Camera height exactly ${EYE_LEVEL_HEIGHT_M}m above the floor; natural ${EYE_LEVEL_LENS_MM}mm full-frame architectural lens, horizontal optical axis, straight verticals, crisp undistorted proportions. No ultra-wide 16mm framing, fisheye, barrel distortion, foreground enlargement or edge stretching. Frame only the room containing the camera, looking along the indicated sightline; never widen the lens to fit more furniture.
${EYE_LEVEL_SHELL_ARCHITECTURE_LOCK} IMAGE 2, when provided, is the original floor plan for verifying architecture, not a camera reference or permission to introduce additional openings.
REMOVE all movable furniture, rugs, decor, plants and artwork. Keep fixed architecture only, realistic material texture, reflections and natural daylight through the recorded windows. No furniture from any reference may enter the shell. Never invent a kitchen island, peninsula, cabinetry or partition that is not explicitly visible in the architectural reference; ambiguous symbols are not permission to add built-ins.
Output one immersive edge-to-edge EYE-LEVEL interior photograph. No axonometric, overhead, dollhouse, inset plan, camera pin, arrow, text, watermark or drafting border.`;
}

export type EyeLevelPlacement = SurfaceProduct & { product_name: string; brand_name?: string; dimensions?: string | null; materials?: string | null; material_override?: string | null; room_section?: string | null; target?: EyeLevelTarget; selected_finishes?: { axis: string; name: string; image_url?: string | null }[] };
export function eyeLevelStagingPrompt(placements: EyeLevelPlacement[], options: { requireTargets?: boolean; hasLayout?: boolean; refinement?: string; roomType?: RoomType } = {}): string {
  if (!placements.length || placements.length > 10) throw new Error("Select between 1 and 10 products.");
  if (options.requireTargets) requireEyeLevelTargets(placements);
  const surfaces = placements.map((p, i) => isEyeLevelSurface(p) ? surfaceStagingInstruction(p, i + 2) : "").filter(Boolean);
  return `Stage the client's EXACT collectible furniture inside the EMPTY EYE-LEVEL SHELL.
${options.roomType ? roomArchitectureConstraint(options.roomType) : ""}
IMAGE ORDER: IMAGE 1 = empty eye-level shell (PRIMARY image and absolute camera/architecture authority). IMAGE 2 through IMAGE ${placements.length + 1} = original studio product photos, one per numbered product below, in exactly that order. Subsequent explicitly labelled images = selected finish swatches and additional angles of those same pieces.${options.hasLayout === false ? " NO blueprint is provided or required." : " A labelled top-down layout may follow ALL furniture references for secondary furniture zones only; never copy its camera or furniture designs."}
${placements.map((p, i) => `${i + 1}. ${p.product_name} by ${p.brand_name || "recorded maker"}; ${eyeLevelShapeGuardrail(p)}; ${validEyeLevelTarget(p.target) ? `PIN ${i + 1}: floor-contact/footprint centre at (${p.target.x.toFixed(2)}%, ${p.target.y.toFixed(2)}%) of IMAGE 1; placement instruction: ${p.target.instruction.trim() || "No additional note; keep the assigned pin and follow INTERIOR SAFETY below."}` : `zone: ${p.room_section || "safe matching furniture zone"}`}; recorded materials: ${p.materials || "as photographed"}; selected finishes: ${(p.selected_finishes || []).map(f => `${f.axis}: ${f.name}`).join("; ") || "as photographed"}${p.material_override ? `; explicit finish override: ${p.material_override}` : ""}`).join("\n")}
IMMUTABLE ARCHITECTURAL BASE: IMAGE 1 is a supplied interior photograph/render, not a blueprint to reinterpret. Keep its actual camera, lens, crop, every wall/window/door edge, glazing mullion, floor line, ceiling, material, built-in, daylight direction and shadow exactly unchanged. New generated shells use natural ${EYE_LEVEL_LENS_MM}mm eye-level architectural framing; on an uploaded/captured shell preserve its existing camera instead of reprojecting the room. Never introduce ultra-wide 16mm foreground distortion, fisheye or oval stretching when inserting furniture. Only new furniture, its contact shadows/reflections and its physically necessary occlusion may alter the base. Never add, remove, enlarge or move a kitchen island, peninsula, counter, cabinet, partition or opening. No invented islands, fake walls or relocated glass doors. NEVER use an overhead reference camera.
STRICT VISUAL REPLICA: PRODUCT n MUST replicate IMAGE n+1, its actual studio photograph. Reproduce the EXACT sculptural silhouette, proportions, leg count/shape/spacing, joinery, arms, backrest, cushions, edge profiles, top/base construction and materials visible in that product's own photos. Names and descriptions identify references; NEVER generate furniture from text names alone. Generic chairs, generic consoles, category approximations, simplified geometry, redesigned furniture, borrowing another selected product's silhouette, and substituting a more familiar design are strictly forbidden. Only viewpoint and physically correct perspective may differ, never the product design. Change only the specified finish axes, using their swatches; unspecified axes stay as photographed. Keep independent seat/backrest/frame/top materials distinct. Respect recorded dimensions and plausible scale, floor contact, natural perspective, contact shadows and reflections.
TRUE RELATIVE SCALE AND LOW PROFILE: use one coherent centimetre scale and the shell's floor perspective for ALL pieces. Compare true W × D × H between the coffee table and surrounding chairs, allowing only correct distance-based perspective scaling. A coffee table recorded at 35 cm must remain strictly below surrounding armchair seat cushions (typically about 42–45 cm, a contextual guide only; recorded seat heights override this range). Never confuse an armchair's total back height with its seat height. Keep the table low, its top/base thickness true to the reference and its footprint proportional to the chairs; never enlarge the table to fill foreground space, raise it to dining height, stretch it into an elongated oval or shrink chairs to accommodate it. Rounded-square (squircle) and compact tables must show their true equal/compact front-to-back depth in floor perspective with distinct softly rounded corners rather than flattening into a long narrow oval. Preserve each distinct selected design exactly once, never substitute another selected chair or duplicate it.
SURFACE PLACEMENTS override furniture floor-contact rules for the named rug/artwork ONLY:
${surfaces.join("\n") || "No selected 2D surfaces."}
SPATIAL PIN AUTHORITY: coordinates are percentages of IMAGE 1, origin top-left, x rightward, y downward; they are not blueprint coordinates or metres. Artwork pins identify vertical wall centres, not floor footprints. Rugs use the centre coffee-table floor area with natural furniture occlusion. For other furniture, anchor the ground-contact/footprint centre at its assigned pin and obey its spatial instruction. Do not relocate a piece to make the composition prettier. Scale W × D × H in the recorded units (cm unless explicitly labelled otherwise) using perspective and architectural scale cues; never resize to fill the image. Missing dimensions remain unconfirmed, never fabricated.
INTERIOR SAFETY: consoles and sideboards must sit flush against a visible SOLID wall or behind an actual selected sofa, with rear face parallel to the wall/sofa. Glass is never a solid wall. Never place consoles in the middle of the living floor, attached to a kitchen island or floating at an opening. Tables belong on open living floor; armchairs face their assigned table/orientation. Keep doors, glazing, circulation, kitchen work zones and furniture footprints clear. Never overlap furniture with counters, islands, glass doors or another piece. If a pin/instruction is impossible, report the conflict without inventing architecture or silently moving the piece.
${options.refinement ? `Requested furniture-only refinement (architecture and pins still win): ${options.refinement}` : ""}
Pieces outside this camera's field of view remain outside it. Do not widen the room or collect other rooms' furniture in this shot. Do not add unselected furniture, accessories or rugs. Copy ONLY the selected studio product designs, NEVER furniture seen in a layout or style reference. Output ONE photorealistic interior photograph, no plan inset, pins, annotations, labels or watermark.`;
}