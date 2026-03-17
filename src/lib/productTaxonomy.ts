export const CATEGORY_ORDER = ["Seating", "Tables", "Lighting", "Storage", "Rugs", "Décor"] as const;

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
  Furniture: "Tables",
  "Wall Art": "Décor",
};

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

export function normalizeCategory(value?: string): string | undefined {
  if (!value) return value;
  return CATEGORY_NORMALIZE[value] || value;
}

export function normalizeSubcategory(value?: string): string | undefined {
  if (!value) return value;
  return SUBCATEGORY_NORMALIZE[value] || value;
}

export function getSubcategoriesForCategory(category: string): string[] {
  return SUBCATEGORY_MAP[category] || [];
}
