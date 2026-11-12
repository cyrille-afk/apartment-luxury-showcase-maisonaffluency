export const moodBoardCategories = ["All", "Seating", "Tables", "Lighting", "Storage", "Rugs", "Other"] as const;
export type MoodBoardCategory = typeof moodBoardCategories[number];
export interface PickerProduct { product_name: string; brand_name: string; category?: string; subcategory?: string }

export function matchesMoodBoardCategory(product: PickerProduct, category: MoodBoardCategory): boolean {
  if (category === "All") return true;
  const text = `${product.category || ""} ${product.subcategory || ""}`.toLowerCase();
  const patterns = { Seating: /seating|chair|sofa|bench|stool|ottoman|pouf/, Tables: /table|desk/, Lighting: /light|lamp|pendant|chandelier|sconce/, Storage: /storage|cabinet|sideboard|credenza|shelf|shelving|bookcase|console/, Rugs: /rug|carpet/ };
  if (category === "Other") return !Object.values(patterns).some(pattern => pattern.test(text));
  return patterns[category].test(text);
}

export function filterMoodBoardCatalog<T extends PickerProduct>(products: T[], search: string, category: MoodBoardCategory, maker: string): T[] {
  const query = search.trim().toLowerCase();
  return products.filter(product => matchesMoodBoardCategory(product, category)
    && (!maker || product.brand_name === maker)
    && (!query || [product.product_name, product.brand_name, product.category, product.subcategory].some(value => value?.toLowerCase().includes(query))));
}

export function shouldRecommendMoodBoard(itemCount: number): boolean { return itemCount >= 1; }