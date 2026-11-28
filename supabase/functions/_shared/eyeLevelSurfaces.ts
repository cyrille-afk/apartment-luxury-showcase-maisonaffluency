import { validEyeLevelTarget, type EyeLevelTarget } from "./eyeLevelPlacement.ts";

export type SurfaceProduct = {
  category_role?: string; width_m?: number; depth_m?: number; height_m?: number;
  product_name: string; target?: EyeLevelTarget;
};
export function isEyeLevelSurface(piece: { category_role?: string }): boolean {
  return piece.category_role === "rug" || piece.category_role === "artwork";
}
export function surfaceMetricSize(piece: SurfaceProduct): string {
  const second = piece.category_role === "artwork" ? piece.height_m : piece.depth_m;
  if (!piece.width_m || !second || ![piece.width_m, second].every(n => Number.isFinite(n) && n > 0)) {
    throw new Error(`Record the metric width and ${piece.category_role === "artwork" ? "height" : "depth"} for ${piece.product_name} before staging.`);
  }
  return `${piece.width_m} × ${second} m (W × ${piece.category_role === "artwork" ? "H" : "D"})`;
}
export function surfaceStagingInstruction(piece: SurfaceProduct, imageNumber = 2): string {
  if (!isEyeLevelSurface(piece)) throw new Error("Choose a catalogue rug or artwork.");
  const size = surfaceMetricSize(piece);
  if (piece.category_role === "rug") return `Place the exact rug from Image ${imageNumber} flat in floor perspective beneath the center coffee table and front legs of the armchairs, scaled to ${size}, while keeping all furniture pieces, walls, and windows 100% unchanged. Preserve the flat studio image's exact pattern, colours, border, pile and W:D proportions. Furniture must occlude the rug naturally; never move, lift, resize or redesign the coffee table or armchairs. No raised platform or folded rug.`;
  if (!validEyeLevelTarget(piece.target)) throw new Error(`Place a wall target pin for ${piece.product_name}.`);
  return `Mount the exact artwork from Image ${imageNumber}, scaled to ${size}, with its centre at WALL PIN (${piece.target.x.toFixed(2)}%, ${piece.target.y.toFixed(2)}%) of IMAGE 1. This is a vertical wall target, NEVER a floor-contact point. Preserve the entire flat image, composition, colours and W:H ratio. Match the selected wall plane's perspective; add a subtle museum frame and natural shallow wall shadow without covering or changing the artwork. Keep the Yoma Console and every other furniture piece, walls, windows, kitchen opening, flooring and camera 100% unchanged. Never mount on glazing, a door or an opening; report an impossible wall target rather than moving it silently.`;
}
export function surfaceEditPrompt(piece: SurfaceProduct): string {
  return `SURFACE-ONLY ADDITION ON IMMUTABLE IMAGE 1 (current locked room render):\n${surfaceStagingInstruction(piece)}\nIMAGE 2 is the target's original full-resolution flat studio image. All following product images identify existing furniture ONLY; never reinsert, restage or change them. Preserve architecture and existing furniture pixel-for-pixel, including carved stone slabs, wood legs, upholstery and joinery. ONLY the new surface, its natural occlusion and necessary contact shadow may change. Keep the complete original crop, aspect ratio, lens, lighting and exposure. Return one seamless full-frame photograph, without pins, annotations or a pasted patch.`;
}