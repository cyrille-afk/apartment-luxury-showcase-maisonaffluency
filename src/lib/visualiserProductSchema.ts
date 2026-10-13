import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import type { FinishTarget, KnownPart } from "@/lib/visualiserFinishTargets";

/**
 * Declarative product → component → allowed finish-group schema.
 * When a product is declared here, its components define the finish tabs
 * (with their own labels) and each tab only shows swatches from its allowed groups.
 * Undeclared products keep model-detected tabs and keyword matching.
 */
export type FinishGroupId = "fabrics" | "leathers" | "woods" | "metals" | "stones";

export interface ProductComponentSpec {
  componentId: string;
  displayName: string;
  part: KnownPart;
  allowedGroups: FinishGroupId[];
}

export interface ProductFinishSchema {
  name: string;
  brand: string;
  components: ProductComponentSpec[];
  /**
   * Default finish part per GLB material name, for models whose node/material
   * names are coded (e.g. "VIFS01" / "09 - Default") so name classification fails.
   * Manual per-mesh mapping still wins over these defaults.
   */
  materialRoles?: Record<string, KnownPart>;
}

export const FINISH_GROUPS: Record<FinishGroupId, { label: string; match: RegExp }> = {
  fabrics: { label: "Fabrics", match: /fabric|textile|velvet|linen|wool|boucl|mohair|cotton|silk|chenille/ },
  leathers: { label: "Leathers", match: /leather|suede|nubuck/ },
  woods: { label: "Woods & Timbers", match: /wood|oak|walnut|ash|veneer|lacquer|timber|teak|elm/ },
  metals: { label: "Metals", match: /metal|bronze|brass|steel|iron|alumin|chrome|nickel|copper/ },
  stones: { label: "Stones & Marble", match: /stone|marble|travertine|onyx|onice|granite|quartz|terrazzo/ },
};

export const PRODUCT_FINISH_SCHEMAS: ProductFinishSchema[] = [
  {
    name: "BOB Armchair",
    brand: "Christophe Delcourt",
    components: [
      { componentId: "main_body", displayName: "Main Body / Seat", part: "upholstery", allowedGroups: ["fabrics", "leathers"] },
      { componentId: "base_trim", displayName: "Base Trim / Accent", part: "base", allowedGroups: ["woods", "metals"] },
    ],
  },
  {
    name: "GUM armchair",
    brand: "Christophe Delcourt",
    components: [
      { componentId: "seat", displayName: "Seat Upholstery", part: "upholstery", allowedGroups: ["fabrics", "leathers"] },
      { componentId: "backrest", displayName: "Backrest Upholstery", part: "backrest", allowedGroups: ["fabrics", "leathers"] },
      { componentId: "frame_legs", displayName: "Frame", part: "frame", allowedGroups: ["woods"] },
    ],
    // GLB nodes are coded "VIFS01…14"; materials: terracotta = frame, white/grey = upholstery.
    materialRoles: { "09 - Default": "frame", "02 - Default": "upholstery", "01 - Default": "backrest" },
  },
  {
    name: "Madison Avenue Side Table",
    brand: "Man of Parts",
    components: [
      { componentId: "table_top", displayName: "Table Top", part: "top", allowedGroups: ["stones"] },
      { componentId: "table_base", displayName: "Base Structure", part: "base", allowedGroups: ["metals"] },
    ],
  },
];

const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Catalogue names often carry the maker ("Madison Avenue Side Table by Yabu Pushelberg"). */
const stripTrailingBrand = (k: string) => k.replace(/ by [a-z0-9 ]+$/, "");

export function findProductSchema(productName?: string | null): ProductFinishSchema | null {
  if (!productName) return null;
  const k = key(productName);
  const bare = stripTrailingBrand(k);
  return PRODUCT_FINISH_SCHEMAS.find((s) => key(s.name) === k || key(s.name) === bare) ?? null;
}

export function schemaTargets(schema: ProductFinishSchema): FinishTarget[] {
  return ["all", ...schema.components.map((c) => c.part)];
}

export function schemaLabels(schema: ProductFinishSchema): Record<string, string> {
  return Object.fromEntries(schema.components.map((c) => [c.part, c.displayName]));
}

/** Material belongs to one of the component's allowed groups. */
export function materialInGroups(material: VisualiserMaterial, groups: FinishGroupId[]): boolean {
  const text = `${material.name ?? ""} ${material.category ?? ""} ${material.material_type ?? ""}`.toLowerCase();
  return groups.some((g) => FINISH_GROUPS[g].match.test(text));
}

export function schemaFits(schema: ProductFinishSchema, material: VisualiserMaterial, target: FinishTarget): boolean {
  if (target === "all") return true;
  const comp = schema.components.find((c) => c.part === target);
  return comp ? materialInGroups(material, comp.allowedGroups) : true;
}
