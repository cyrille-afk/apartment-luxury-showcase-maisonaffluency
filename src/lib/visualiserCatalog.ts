import { CATEGORY_ORDER, SUBCATEGORY_MAP, inferSubcategory, normalizeCategory, normalizeSubcategory } from "@/lib/productTaxonomy";

export interface VisualiserCatalogItem {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  category: string;
  subcategory?: string | null;
  glb_url: string | null;
}

export const DEFAULT_MODELS_ONLY = true;

/** Validate the associated geometry URL, never the thumbnail or a non-empty string. */
export function has3dAsset(item: Pick<VisualiserCatalogItem, "glb_url">): boolean {
  if (!item.glb_url?.trim()) return false;
  try {
    const url = new URL(item.glb_url.trim());
    return ["https:", "http:"].includes(url.protocol) && /\.(glb|gltf|obj)$/i.test(decodeURIComponent(url.pathname));
  } catch { return false; }
}

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function placements(item: VisualiserCatalogItem) {
  const subcategories = item.subcategory
    ? item.subcategory.split(/\s+\/\s+/).map(value => normalizeSubcategory(value)).filter((value): value is string => Boolean(value))
    : [inferSubcategory(item.category, undefined, item.product_name)];
  const categories = item.category.split(/\s+\/\s+/).map(value => normalizeCategory(value, subcategories[0])).filter((value): value is string => Boolean(value));
  return { categories, subcategories };
}

export interface CatalogCriteria { modelsOnly?: boolean; designer?: string; category?: string; subcategory?: string; search?: string }

export function filterVisualiserCatalog<T extends VisualiserCatalogItem>(items: T[], criteria: CatalogCriteria = {}): T[] {
  const { modelsOnly = DEFAULT_MODELS_ONLY, designer = "all", category = "all", subcategory = "all", search = "" } = criteria;
  const query = fold(search.trim());
  return items.filter(item => {
    if (modelsOnly && !has3dAsset(item)) return false;
    if (designer !== "all" && item.brand_name !== designer) return false;
    const taxonomy = placements(item);
    if (category !== "all" && !taxonomy.categories.includes(category)) return false;
    if (subcategory !== "all" && !taxonomy.subcategories.includes(subcategory)) return false;
    return !query || fold(`${item.product_name} ${item.brand_name} ${item.category} ${item.subcategory ?? ""}`).includes(query);
  });
}

export function visualiserCatalogFacets(items: VisualiserCatalogItem[], criteria: CatalogCriteria) {
  const designerItems = filterVisualiserCatalog(items, { ...criteria, designer: "all", category: "all", subcategory: "all" });
  const categoryItems = filterVisualiserCatalog(items, { ...criteria, category: "all", subcategory: "all" });
  const subcategoryItems = filterVisualiserCatalog(items, { ...criteria, subcategory: "all" });
  const categories = CATEGORY_ORDER.map(label => ({ label, count: categoryItems.filter(item => placements(item).categories.includes(label)).length }));
  const subcategoryLabels = criteria.category && criteria.category !== "all" ? SUBCATEGORY_MAP[criteria.category] ?? [] : [...new Set(Object.values(SUBCATEGORY_MAP).flat())];
  return {
    designers: [...new Set(designerItems.map(item => item.brand_name))].sort((a, b) => fold(a).localeCompare(fold(b))),
    categories,
    subcategories: subcategoryLabels.map(label => ({ label, count: subcategoryItems.filter(item => placements(item).subcategories.includes(label)).length })),
    categoryTotal: categoryItems.length,
    subcategoryTotal: subcategoryItems.length,
  };
}