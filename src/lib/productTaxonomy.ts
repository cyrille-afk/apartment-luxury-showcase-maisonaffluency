export const CATEGORY_ORDER = ["Seating", "Tables", "Lighting", "Storage", "Rugs", "Décor"];

export const SUBCATEGORY_MAP: Record<string, string[]> = {
  Seating: ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools", "Bar Stools"],
  Tables: ["Consoles", "Coffee Tables", "Desks", "Dining Tables", "Side Tables"],
  Lighting: ["Wall Lights", "Ceiling Lights", "Floor Lights", "Table Lights"],
  Storage: ["Bookcases", "Cabinets"],
  Rugs: ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"],
  Décor: ["Vases & Vessels", "Mirrors", "Books", "Candle Holders", "Decorative Objects"],
};

// Map non-canonical category values to canonical taxonomy labels
const CATEGORY_NORMALIZE: Record<string, string> = {
  "Decorative Object": "Décor",
  "Decorative Objects": "Décor",
  "Wall Art": "Décor",
  Accessories: "Décor",
  Objects: "Décor",
  Decorative: "Décor",
  Textiles: "Décor",
  Linens: "Décor",
  Screens: "Décor",
  Sculpture: "Décor",
};

// Subcategories that belong to Seating (used to resolve "Furniture" → correct parent)
const SEATING_SUBCATEGORIES = new Set([
  "Sofas", "Sofa", "Armchairs", "Armchair", "Chairs", "Chair",
  "Daybeds & Benches", "Daybed", "Bench", "Ottomans & Stools",
  "Ottoman", "Stool", "Stools", "Bar Stools", "Bar Stool",
]);

const TABLES_SUBCATEGORIES = new Set([
  "Consoles", "Console", "Coffee Tables", "Coffee Table",
  "Desks", "Desk", "Dining Tables", "Dining Table",
  "Side Tables", "Side Table", "Table",
]);

const STORAGE_SUBCATEGORIES = new Set([
  "Bookcases", "Bookcase", "Cabinets", "Cabinet",
  "Bookcases & Credenzas", "Sideboards", "Sideboard",
]);

/**
 * Resolve ambiguous "Furniture" category using subcategory hint.
 */
function resolveFurniture(subcategory?: string): string {
  if (!subcategory) return "Tables"; // fallback
  if (SEATING_SUBCATEGORIES.has(subcategory)) return "Seating";
  if (TABLES_SUBCATEGORIES.has(subcategory)) return "Tables";
  if (STORAGE_SUBCATEGORIES.has(subcategory)) return "Storage";
  return "Tables"; // fallback for unknown subcategories
}

// Map singular/non-canonical subcategories to canonical plural labels
const SUBCATEGORY_NORMALIZE: Record<string, string> = {
  Console: "Consoles",
  "Coffee Table": "Coffee Tables",
  "Dining Table": "Dining Tables",
  "Side Table": "Side Tables",
  Desk: "Desks",
  Cabinet: "Cabinets",
  Bookcase: "Bookcases",
  "Bookcases & Credenzas": "Bookcases",
  Sofa: "Sofas",
  Armchair: "Armchairs",
  Chair: "Chairs",
  "Bar Stool": "Bar Stools",
  Ottoman: "Ottomans & Stools",
  Stool: "Ottomans & Stools",
  Stools: "Ottomans & Stools",
  Daybed: "Daybeds & Benches",
  Bench: "Daybeds & Benches",
  "Wall Light": "Wall Lights",
  "Wall Sconce": "Wall Lights",
  "Wall Sconces": "Wall Lights",
  "Ceiling Light": "Ceiling Lights",
  "Floor Light": "Floor Lights",
  "Floor Lamp": "Floor Lights",
  "Floor Lamps": "Floor Lights",
  "Table Light": "Table Lights",
  "Table Lamp": "Table Lights",
  "Table Lamps": "Table Lights",
  Pendant: "Ceiling Lights",
  Pendants: "Ceiling Lights",
  Chandelier: "Ceiling Lights",
  Chandeliers: "Ceiling Lights",
  Vase: "Vases & Vessels",
  Vases: "Vases & Vessels",
  Vessel: "Vases & Vessels",
  Vessels: "Vases & Vessels",
  Mirror: "Mirrors",
  Book: "Books",
  "Candle Holder": "Candle Holders",
  "Decorative Object": "Decorative Objects",
  "Sculptural Object": "Decorative Objects",
  Tableware: "Decorative Objects",
  Sideboards: "Cabinets",
  Sideboard: "Cabinets",
  "Hand-Knotted Rug": "Hand-Knotted Rugs",
  "Hand-Tufted Rug": "Hand-Tufted Rugs",
  "Hand-Woven Rug": "Hand-Woven Rugs",
  Wallcoverings: "Decorative Objects",
};

// Reverse lookup: given a raw value that might be a subcategory name, find its parent category
function findParentCategory(value: string): string | undefined {
  const normalized = SUBCATEGORY_NORMALIZE[value] || value;
  for (const [cat, subs] of Object.entries(SUBCATEGORY_MAP)) {
    if (subs.includes(normalized)) return cat;
  }
  return undefined;
}

export function normalizeCategory(value?: string, subcategory?: string): string | undefined {
  if (!value) return value;
  if (value === "Furniture") return resolveFurniture(subcategory);
  const mapped = CATEGORY_NORMALIZE[value] || value;
  // If the mapped value is a known top-level category, use it
  if (CATEGORY_ORDER.includes(mapped)) return mapped;
  // Otherwise it might be a subcategory used as a category (e.g. "Consoles")
  const parent = findParentCategory(value);
  if (parent) return parent;
  return mapped;
}

export function normalizeSubcategory(value?: string): string | undefined {
  if (!value) return value;
  return SUBCATEGORY_NORMALIZE[value] || value;
}

/**
 * When subcategory is missing, try to derive it from the raw category value
 * (e.g. raw category "Consoles" → subcategory "Consoles")
 */
export function inferSubcategory(rawCategory?: string, rawSubcategory?: string): string {
  if (rawSubcategory) return normalizeSubcategory(rawSubcategory) || "Other";
  if (!rawCategory) return "Other";
  // If raw category is actually a subcategory name, use it
  const normalized = SUBCATEGORY_NORMALIZE[rawCategory] || rawCategory;
  const parent = findParentCategory(rawCategory);
  if (parent) return normalized;
  return "Other";
}

export function getSubcategoriesForCategory(category: string): string[] {
  return SUBCATEGORY_MAP[category] || [];
}
