import { absoluteUrl } from "@/config/site";
import { parseDimensionString } from "./productDimensions";
import { viewingRoomViewerMaterials, type ViewingRoomChoice } from "./viewingRoom";

export type BlenderSelectedFinish = {
  axis: string;
  label: string;
  id: string | null;
  name: string;
  category: string | null;
  brand_name: string | null;
  texture_url: string | null;
};

export type BlenderSceneItem = {
  sku: string;
  name: string;
  category_role: string | null;
  width_m: number | null;
  depth_m: number | null;
  height_m: number | null;
  glb_url_compressed: string | null;
  selected_finishes: BlenderSelectedFinish[];
};

export type BlenderSceneManifest = {
  schema_version: 1;
  exported_at: string;
  proposal_id: string;
  locked_at: string;
  package_tier: string;
  residence_layout: {
    name: string;
    floorplan_url: string | null;
  };
  items: BlenderSceneItem[];
};

export type BlenderCatalogLookup = {
  id: string;
  sku: string | null;
  name: string | null;
  category_role: string | null;
  width_m: number | null;
  depth_m: number | null;
  height_m: number | null;
  glb_url_compressed: string | null;
};

export type BlenderProductLookup = {
  id: string;
  sku: string | null;
  product_name: string | null;
  category: string | null;
  subcategory: string | null;
  dimensions: string | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  glb_url: string | null;
};

export type BlenderSlotRuleLookup = {
  board_item_id: string;
  category_role_override: string | null;
  width_m_override: number | null;
  depth_m_override: number | null;
  height_m_override: number | null;
};

export type LockedProposalItemSnapshot = ViewingRoomChoice & {
  slot_id?: string;
  label?: string;
};

function resolveMediaUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return trimmed;
  if (trimmed.startsWith("/")) return absoluteUrl(trimmed);
  return null;
}

function positiveNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 1000) / 1000 : null;
}

function mmToMeters(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value) / 1000;
}

function deriveCategoryRole(category?: string | null, subcategory?: string | null, name?: string | null): string | null {
  const text = `${category ?? ""} ${subcategory ?? ""} ${name ?? ""}`.toLowerCase();
  if (/\b(sofa|canap[eé]|settee|sectional)\b/i.test(text)) return "sofa";
  if (/\b(coffee|cocktail|low)\b[\s-]*\btable\b/i.test(text)) return "coffee_table";
  if (/\b(side|end|bedside|occasional|accent)[\s-]*table\b/i.test(text)) return "side_table";
  if (/\b(console|sideboard|credenza|buffet)\b/i.test(text)) return "console";
  if (/\b(armchair|lounge\s*chair|club\s*chair|accent\s*chair|berg[eè]re|fauteuil)\b/i.test(text)) return "lounge_chair";
  if (/\bdining\b/i.test(text) && /\btable\b/i.test(text)) return "dining_table";
  if (/\bdining\b/i.test(text) && /\bchair\b/i.test(text)) return "dining_chair";
  if (/\b(bookcase|bookshelf|shelving|cabinet|storage)\b/i.test(text)) return "storage";
  if (/\bchair\b/i.test(text)) return "lounge_chair";
  const fallback = (subcategory ?? category ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return fallback || null;
}

function finishAxisLabel(axis: string, hasBackrest: boolean, category: string): string {
  if (axis === "upholstery") return hasBackrest ? "Seat upholstery" : "Upholstery";
  if (axis === "backrest") return "Backrest leather";
  if (axis === "base") return "Frame / base";
  if (axis === "top") return "Tabletop";
  return category || "Selected finish";
}

export function blenderSelectedFinishes(item: LockedProposalItemSnapshot): BlenderSelectedFinish[] {
  const materials = viewingRoomViewerMaterials(item);
  const hasBackrest = Boolean(materials["backrest"]);
  const entries: BlenderSelectedFinish[] = [];
  for (const [axis, material] of Object.entries(materials)) {
    if (axis.startsWith("default-")) continue;
    const rawName = material.name.trim();
    const name = /^\d+$/.test(rawName)
      ? `Selected ${material.category || "material"} — name to be confirmed`
      : rawName;
    entries.push({
      axis,
      label: finishAxisLabel(axis, hasBackrest, material.category),
      id: material.id || null,
      name,
      category: material.category || null,
      brand_name: material.brand_name || null,
      texture_url: resolveMediaUrl(material.image_url),
    });
  }
  if (!entries.length && item.label?.trim()) {
    entries.push({
      axis: "finish",
      label: "Selected finish",
      id: null,
      name: item.label.trim(),
      category: null,
      brand_name: null,
      texture_url: null,
    });
  }
  return entries;
}

export function buildBlenderSceneManifest(input: {
  proposalId: string;
  lockedAt: string;
  exportedAt?: string;
  packageTier: string;
  layout: { name: string; floorplan_url: string | null };
  items: LockedProposalItemSnapshot[];
  boardItemProducts: Map<string, string>;
  catalogById: Map<string, BlenderCatalogLookup>;
  productsById: Map<string, BlenderProductLookup>;
  slotRulesByBoardItemId: Map<string, BlenderSlotRuleLookup>;
}): BlenderSceneManifest {
  const items: BlenderSceneItem[] = input.items.map((item) => {
    const slotId = item.slot_id ?? item.id;
    const isSwapped = item.id !== slotId;
    const productId = isSwapped ? item.id : (input.boardItemProducts.get(slotId) ?? item.id);
    const catalog = input.catalogById.get(productId);
    const product = input.productsById.get(productId);
    const rule = input.slotRulesByBoardItemId.get(slotId);

    const selectedSizeDims = item.size_key
      ? parseDimensionString(item.dimensions ?? item.size_key)
      : null;
    const parsedFallbackDims = parseDimensionString(item.dimensions ?? product?.dimensions);

    const width_m = (selectedSizeDims ? mmToMeters(selectedSizeDims.w) : null)
      ?? positiveNumber(catalog?.width_m)
      ?? (!isSwapped ? positiveNumber(rule?.width_m_override) : null)
      ?? mmToMeters(item.width_mm)
      ?? mmToMeters(product?.width_mm)
      ?? (parsedFallbackDims ? mmToMeters(parsedFallbackDims.w) : null);

    const depth_m = (selectedSizeDims ? mmToMeters(selectedSizeDims.d) : null)
      ?? positiveNumber(catalog?.depth_m)
      ?? (!isSwapped ? positiveNumber(rule?.depth_m_override) : null)
      ?? mmToMeters(item.depth_mm)
      ?? mmToMeters(product?.depth_mm)
      ?? (parsedFallbackDims ? mmToMeters(parsedFallbackDims.d) : null);

    const height_m = (selectedSizeDims ? mmToMeters(selectedSizeDims.h) : null)
      ?? positiveNumber(catalog?.height_m)
      ?? (!isSwapped ? positiveNumber(rule?.height_m_override) : null)
      ?? mmToMeters(item.height_mm)
      ?? mmToMeters(product?.height_mm)
      ?? (parsedFallbackDims ? mmToMeters(parsedFallbackDims.h) : null);

    const name = (catalog?.name ?? item.product_name ?? product?.product_name ?? "").trim();
    const sku = (catalog?.sku ?? product?.sku ?? productId).trim();
    const category_role = catalog?.category_role?.trim()
      || rule?.category_role_override?.trim()
      || deriveCategoryRole(item.category ?? product?.category, item.subcategory ?? product?.subcategory, name);
    const glb_url_compressed = resolveMediaUrl(catalog?.glb_url_compressed ?? item.glb_url ?? product?.glb_url);

    return {
      sku,
      name,
      category_role,
      width_m,
      depth_m,
      height_m,
      glb_url_compressed,
      selected_finishes: blenderSelectedFinishes(item),
    };
  });

  return {
    schema_version: 1,
    exported_at: input.exportedAt ?? new Date().toISOString(),
    proposal_id: input.proposalId,
    locked_at: input.lockedAt,
    package_tier: input.packageTier,
    residence_layout: {
      name: input.layout.name.trim(),
      floorplan_url: resolveMediaUrl(input.layout.floorplan_url),
    },
    items,
  };
}

function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scene";
}

export function blenderSceneFilename(manifest: Pick<BlenderSceneManifest, "residence_layout" | "package_tier">): string {
  return `blender-scene-${slugPart(manifest.residence_layout.name)}-${slugPart(manifest.package_tier)}.json`;
}

export function downloadBlenderSceneManifest(manifest: BlenderSceneManifest): string {
  const filename = blenderSceneFilename(manifest);
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return filename;
}