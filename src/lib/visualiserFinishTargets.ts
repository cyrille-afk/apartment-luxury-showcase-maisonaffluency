import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";

/** Named texturable roles a GLB can expose. */
export type KnownPart = "top" | "frame" | "base" | "upholstery" | "drawer" | "door" | "shelf" | "handle";
/** A known role, or `part:<group>` for an unnamed but separately-materialled part. */
export type FinishPart = KnownPart | `part:${string}`;
export type FinishTarget = "all" | FinishPart;

export const KNOWN_PART_LABELS: Record<KnownPart, string> = {
  top: "Top",
  frame: "Frame",
  base: "Base",
  upholstery: "Upholstery",
  drawer: "Drawer",
  door: "Door",
  shelf: "Shelf",
  handle: "Handle",
};
export const FINISH_TARGET_LABELS: Record<"all" | KnownPart, string> = { all: "Whole Piece", ...KNOWN_PART_LABELS };
export const KNOWN_PARTS = Object.keys(KNOWN_PART_LABELS) as KnownPart[];

const PART_ORDER: KnownPart[] = ["top", "frame", "base", "upholstery", "drawer", "door", "shelf", "handle"];
const LEGACY_FIELD = { top: "topMaterial", base: "baseMaterial", upholstery: "upholsteryMaterial" } as const;

export const isKnownPart = (p: string): p is KnownPart => p in KNOWN_PART_LABELS;

/** Classifies one GLB mesh/node name into a texturable role (single source for canvas + sidebar). */
export function classifyTextureNode(nodeName: string): KnownPart | null {
  const name = nodeName.toLowerCase();
  if (/upholstery|fabric|cushion|seat|cover|textile|leather|pillow/.test(name)) return "upholstery";
  if (/drawer/.test(name)) return "drawer";
  if (/door|front|panel/.test(name)) return "door";
  if (/handle|knob|pull/.test(name)) return "handle";
  if (/shelf|shelves/.test(name)) return "shelf";
  // Exporters often name the frame by its material (e.g. Man of Parts "WoodFinish").
  // \barms?\b is word-boundaried so "Armchair" in a parent name doesn't force frame.
  if (/frame|carcass|body|structure|wood|timber|finish|\barms?\b/.test(name)) return "frame";
  if (/base|leg|stem|pedestal|foot|feet|glide|column|bracket|plinth|metal/.test(name)) return "base";
  if (/top|surface|plate|tabletop|marble|stone|counter/.test(name)) return "top";
  return null;
}

/** Classifies a mesh by node name, falling back to its material name when unnamed. */
export function classifyMeshPart(nodeName: string, materialName: string): KnownPart | null {
  return classifyTextureNode(nodeName) ?? classifyTextureNode(materialName);
}

/** Sub-tabs for a product: Whole Piece plus each part its model actually contains. */
export function finishTargetsFromParts(parts: Iterable<FinishPart>): FinishTarget[] {
  const found = new Set(parts);
  const custom = [...found].filter((p) => !isKnownPart(p)).sort();
  return ["all", ...PART_ORDER.filter((part) => found.has(part)), ...custom];
}

const GENERIC_PART_NAME = /^(material|object|mesh|group|node|geometry|scene|model|part|component|defaultmaterial)$/i;

/**
 * Turns a raw GLB material/node name into a readable component label
 * ("WoodFinish" → "Wood Finish", "Table_Top_Mesh" → "Table Top Mesh").
 * Returns "" for names that carry no usable words (UUIDs, "Material.001").
 */
export function humanizePartName(raw: string): string {
  const cleaned = raw
    .replace(/^part:/, "")
    .replace(/\.\d+$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (/^[0-9a-f-]+$/i.test(cleaned) && cleaned.length >= 16) return "";
  if (!/[a-z]{3}/i.test(cleaned)) return "";
  const label = cleaned
    .split(" ")
    .map((word) => (word === "and" || word === "of" ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
  const stem = label.replace(/\s+\d+$/, "");
  return GENERIC_PART_NAME.test(stem) ? "" : label;
}

export function targetLabel(target: FinishTarget, customLabels: Record<string, string> = {}): string {
  // A declared component name ("Table Top") always beats the generic role label ("Top").
  return customLabels[target]
    || (target === "all" || isKnownPart(target)
      ? FINISH_TARGET_LABELS[target as "all" | KnownPart]
      : humanizePartName(target))
    || "Part";
}

type PartHolder = {
  material?: VisualiserMaterial | null;
  topMaterial?: VisualiserMaterial | null;
  baseMaterial?: VisualiserMaterial | null;
  upholsteryMaterial?: VisualiserMaterial | null;
  partMaterials?: Record<string, VisualiserMaterial | null>;
};

/** The canvas and inspector share exactly the same part inheritance policy. */
export function meshPartMaterial(o: PartHolder, part: FinishPart | null): VisualiserMaterial | null {
  const own = part ? getPartMaterial(o, part) : null;
  return part === "upholstery" ? own : own ?? o.material ?? null;
}

/** Finish on one part; top/base/upholstery keep their legacy fields for saved compositions. */
export function getPartMaterial(o: PartHolder, part: FinishTarget): VisualiserMaterial | null {
  if (part === "all") return o.material ?? null;
  if (part in LEGACY_FIELD) return o[LEGACY_FIELD[part as keyof typeof LEGACY_FIELD]] ?? null;
  return o.partMaterials?.[part] ?? null;
}

export function withPartMaterial<T extends PartHolder>(o: T, part: FinishTarget, m: VisualiserMaterial | null): T {
  if (part === "all") return { ...o, material: m, topMaterial: null, baseMaterial: null, partMaterials: {} , upholsteryMaterial: o.upholsteryMaterial };
  if (part in LEGACY_FIELD) return { ...o, [LEGACY_FIELD[part as keyof typeof LEGACY_FIELD]]: m };
  return { ...o, partMaterials: { ...(o.partMaterials ?? {}), [part]: m } };
}

export const hasAnyFinish = (o: PartHolder) =>
  Boolean(o.material || o.topMaterial || o.baseMaterial || o.upholsteryMaterial || Object.values(o.partMaterials ?? {}).some(Boolean));

const PART_KEYWORDS: Record<KnownPart, RegExp> = {
  top: /stone|marble|travertine|granite|onyx|quartz|wood|oak|walnut|ash|veneer|glass|lacquer|ceramic|terrazzo|leather/,
  frame: /wood|oak|walnut|ash|veneer|lacquer|metal|bronze|brass|steel|iron|alumin|chrome|nickel|stuc|cement|rattan|cane/,
  base: /metal|bronze|brass|steel|iron|alumin|chrome|nickel|copper|wood|oak|walnut|ash|lacquer|powder/,
  upholstery: /fabric|textile|velvet|linen|wool|boucl|leather|suede|mohair|cotton|silk|chenille/,
  drawer: /wood|oak|walnut|ash|veneer|lacquer|leather|suede|stone|marble|metal/,
  door: /wood|oak|walnut|ash|veneer|lacquer|glass|metal|cane|rattan|stone/,
  shelf: /wood|oak|walnut|ash|veneer|lacquer|glass|stone|marble|metal/,
  handle: /metal|bronze|brass|steel|iron|chrome|nickel|copper|leather|wood/,
};

/** Finishes valid for a given part. Explicit `target` wins; otherwise category/type keywords decide. */
export function materialFitsTarget(material: VisualiserMaterial, target: FinishTarget): boolean {
  if (target === "all" || !isKnownPart(target)) return true;
  if (material.target) return material.target === target || (target === "frame" && material.target === "base");
  const text = `${material.category ?? ""} ${material.material_type ?? ""}`.toLowerCase();
  return PART_KEYWORDS[target].test(text);
}
