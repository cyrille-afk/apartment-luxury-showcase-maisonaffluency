import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";

/** Texture node roles a GLB can expose. "all" = whole piece. */
export type FinishPart = "upholstery" | "base" | "top";
export type FinishTarget = "all" | FinishPart;

export const FINISH_TARGET_LABELS: Record<FinishTarget, string> = {
  all: "Whole Piece",
  top: "Top",
  base: "Base",
  upholstery: "Upholstery",
};

const PART_ORDER: FinishPart[] = ["top", "base", "upholstery"];

/** Classifies one GLB mesh/node name into a texturable part (single source for canvas + sidebar). */
export function classifyTextureNode(nodeName: string): FinishPart | null {
  const name = nodeName.toLowerCase();
  if (/upholstery|fabric|cushion|seat|cover|textile/.test(name)) return "upholstery";
  if (/base|frame|leg|stem|pedestal|foot|column|bracket/.test(name)) return "base";
  if (/top|surface|plate|tabletop|marble|stone|counter|shelf/.test(name)) return "top";
  return null;
}

/** Sub-tabs for a product: Whole Piece plus each part its model actually contains. */
export function finishTargetsFromParts(parts: Iterable<FinishPart>): FinishTarget[] {
  const found = new Set(parts);
  return ["all", ...PART_ORDER.filter((part) => found.has(part))];
}

const PART_KEYWORDS: Record<FinishPart, RegExp> = {
  top: /stone|marble|travertine|granite|onyx|quartz|wood|oak|walnut|ash|veneer|glass|lacquer|ceramic|terrazzo|leather/,
  base: /metal|bronze|brass|steel|iron|alumin|chrome|nickel|copper|wood|oak|walnut|ash|lacquer|powder/,
  upholstery: /fabric|textile|velvet|linen|wool|boucl|leather|suede|mohair|cotton|silk|chenille/,
};

/** Finishes valid for a given part. Explicit `target` wins; otherwise category/type keywords decide. */
export function materialFitsTarget(material: VisualiserMaterial, target: FinishTarget): boolean {
  if (target === "all") return true;
  if (material.target) return material.target === target;
  const text = `${material.category ?? ""} ${material.material_type ?? ""}`.toLowerCase();
  return PART_KEYWORDS[target].test(text);
}
