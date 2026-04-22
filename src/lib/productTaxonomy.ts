export const CATEGORY_ORDER = ["Seating", "Tables", "Lighting", "Storage", "Bedroom Furniture", "Rugs", "Décor"];

export const SUBCATEGORY_MAP: Record<string, string[]> = {
  Seating: ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools", "Bar Stools"],
  Tables: ["Consoles", "Coffee Tables", "Desks", "Dining Tables", "Side Tables"],
  Lighting: ["Wall Lights", "Ceiling Lights", "Floor Lights", "Table Lights"],
  Storage: ["Bookcases", "Cabinets"],
  "Bedroom Furniture": ["Headboards"],
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
  Bedroom: "Bedroom Furniture",
  "Bed Furniture": "Bedroom Furniture",
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

const LIGHTING_SUBCATEGORIES = new Set([
  "Wall Lights", "Wall Light", "Wall Lamp", "Wall Lamps", "Wall Sconce", "Wall Sconces", "Sconce", "Sconces",
  "Ceiling Lights", "Ceiling Light", "Pendant", "Pendants", "Pendant Lamp", "Pendant Lamps", "Pendant Light", "Pendant Lights",
  "Chandelier", "Chandeliers", "Suspension", "Suspensions", "Lantern", "Lanterns",
  "Floor Lights", "Floor Light", "Floor Lamp", "Floor Lamps",
  "Table Lights", "Table Light", "Table Lamp", "Table Lamps", "Portable Lamp", "Portable Lamps", "Desk Lamp", "Desk Lamps",
]);

const STORAGE_SUBCATEGORIES = new Set([
  "Bookcases", "Bookcase", "Cabinets", "Cabinet",
  "Bookcases & Credenzas", "Sideboards", "Sideboard",
]);

const BEDROOM_SUBCATEGORIES = new Set([
  "Headboards", "Headboard",
]);

/**
 * Resolve ambiguous "Furniture" category using subcategory hint.
 */
function resolveFurniture(subcategory?: string): string {
  const normalized = normalizeSubcategory(subcategory) || subcategory;
  if (!normalized) return "Tables";
  if (SEATING_SUBCATEGORIES.has(normalized)) return "Seating";
  if (TABLES_SUBCATEGORIES.has(normalized)) return "Tables";
  if (LIGHTING_SUBCATEGORIES.has(normalized)) return "Lighting";
  if (STORAGE_SUBCATEGORIES.has(normalized)) return "Storage";
  if (BEDROOM_SUBCATEGORIES.has(normalized)) return "Bedroom Furniture";
  return findParentCategory(normalized) || "Tables";
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
  "Wall Lamp": "Wall Lights",
  "Wall Lamps": "Wall Lights",
  "Wall Sconce": "Wall Lights",
  "Wall Sconces": "Wall Lights",
  Sconce: "Wall Lights",
  Sconces: "Wall Lights",
  "Ceiling Light": "Ceiling Lights",
  "Pendant Light": "Ceiling Lights",
  "Pendant Lights": "Ceiling Lights",
  "Pendant Lamp": "Ceiling Lights",
  "Pendant Lamps": "Ceiling Lights",
  Suspension: "Ceiling Lights",
  Suspensions: "Ceiling Lights",
  "Floor Light": "Floor Lights",
  "Floor Lamp": "Floor Lights",
  "Floor Lamps": "Floor Lights",
  "Table Light": "Table Lights",
  "Table Lamp": "Table Lights",
  "Table Lamps": "Table Lights",
  "Portable Lamp": "Table Lights",
  "Portable Lamps": "Table Lights",
  "Desk Lamp": "Table Lights",
  "Desk Lamps": "Table Lights",
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
  "Sofas & Loveseats": "Sofas",
  "Pendant Lighting": "Ceiling Lights",
  Lantern: "Ceiling Lights",
  Lanterns: "Ceiling Lights",
  "Dining Chair": "Chairs",
  "Dining Chairs": "Chairs",
  "Lounge Chair": "Armchairs",
  "Club Chair": "Armchairs",
  "Limited Edition": "Decorative Objects",
  "Limited Editions": "Decorative Objects",
  "Iconic Editions": "Decorative Objects",
  Centrepiece: "Decorative Objects",
  Photography: "Decorative Objects",
  Abstract: "Decorative Objects",
  Wildlife: "Decorative Objects",
  Landscape: "Decorative Objects",
  Architecture: "Decorative Objects",
  Piano: "Decorative Objects",
  "Lighting & Sculpture": "Ceiling Lights",
  "Sculpture & Furniture": "Decorative Objects",
  "Sculptural Furniture": "Decorative Objects",
  "Sculptural Objects": "Decorative Objects",
  "Architecture & Interiors": "Decorative Objects",
  "Seating & Tables": "Chairs",
  "Tables & Objects": "Side Tables",
  "Tables & Sculpture": "Side Tables",
  "Tables & Seating": "Side Tables",
  // Display Cabinet → Cabinets
  "Display Cabinet": "Cabinets",
  "High Table": "Side Tables",
  Headboard: "Headboards",
  Table: "Side Tables",
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
  const normalizedSubcategory = normalizeSubcategory(subcategory) || subcategory;
  if (!value) return normalizedSubcategory ? findParentCategory(normalizedSubcategory) : value;
  if (value === "Furniture") return resolveFurniture(normalizedSubcategory);
  const mapped = CATEGORY_NORMALIZE[value] || value;
  if (CATEGORY_ORDER.includes(mapped)) return mapped;
  const parent = findParentCategory(mapped) || (normalizedSubcategory ? findParentCategory(normalizedSubcategory) : undefined) || findParentCategory(value);
  if (parent) return parent;
  return mapped;
}

// Case-insensitive lookup map built from SUBCATEGORY_NORMALIZE
const SUBCATEGORY_NORMALIZE_CI: Record<string, string> = Object.fromEntries(
  Object.entries(SUBCATEGORY_NORMALIZE).map(([k, v]) => [k.toLowerCase(), v])
);

export function normalizeSubcategory(value?: string): string | undefined {
  if (!value) return value;
  const trimmed = value.trim();
  return (
    SUBCATEGORY_NORMALIZE[trimmed] ||
    SUBCATEGORY_NORMALIZE_CI[trimmed.toLowerCase()] ||
    trimmed
  );
}

// Title-based keyword patterns → canonical subcategory (order matters: specific before generic)
const TITLE_SUBCATEGORY_HINTS: [RegExp, string][] = [
  // Seating
  [/\bsofa\b/i, "Sofas"],
  [/\bcanap[ée]/i, "Sofas"],
  [/\b3[- ]?seater\b/i, "Sofas"],
  [/\barmchair\b/i, "Armchairs"],
  [/\bfauteuil\b/i, "Armchairs"],
  [/\bclub\s*chair\b/i, "Armchairs"],
  [/\bdining\s*chair\b/i, "Chairs"],
  [/\bchair\b/i, "Chairs"],
  [/\bdaybed\b/i, "Daybeds & Benches"],
  [/\bbench\b/i, "Daybeds & Benches"],
  [/\btransat\b/i, "Daybeds & Benches"],
  [/\bbar\s*stool\b/i, "Bar Stools"],
  [/\bstool\b/i, "Ottomans & Stools"],
  [/\bottoman\b/i, "Ottomans & Stools"],
  // Tables
  [/\bconsolle?\b/i, "Consoles"],
  [/\bconsole\b/i, "Consoles"],
  [/\bcoffee\s*table\b/i, "Coffee Tables"],
  [/\bside\s*table\b/i, "Side Tables"],
  [/\bdesk\b/i, "Desks"],
  [/\bdining\s*table\b/i, "Dining Tables"],
  [/\bround\s*table\b/i, "Dining Tables"],
  [/\btable\b/i, "Side Tables"],
  // Lighting — specific first
  [/\bsconce\b/i, "Wall Lights"],
  [/\bwall\s*l(?:amp|ight)\b/i, "Wall Lights"],
  [/\buplight\b/i, "Wall Lights"],
  [/\bapplique\b/i, "Wall Lights"],
  [/\bpendant\b/i, "Ceiling Lights"],
  [/\bchandelier\b/i, "Ceiling Lights"],
  [/\bceiling\s*l(?:amp|ight)\b/i, "Ceiling Lights"],
  [/\blantern\b/i, "Ceiling Lights"],
  [/\bsuspension\b/i, "Ceiling Lights"],
  [/\bfloor\s*l(?:amp|ight)\b/i, "Floor Lights"],
  [/\btable\s*l(?:amp|ight)\b/i, "Table Lights"],
  [/\bportable\s*l(?:amp|ight)\b/i, "Table Lights"],
  [/\blaqu[ée]\s.*lamp\b/i, "Table Lights"],
  [/\bsocle\s.*lamp\b/i, "Table Lights"],
  [/\bdesk\s*l(?:amp|ight)\b/i, "Table Lights"],
  [/\blamp\b/i, "Table Lights"],  // generic "lamp" → table light
  // Storage
  [/\bbookcase\b/i, "Bookcases"],
  [/\bcredenza\b/i, "Cabinets"],
  [/\bsideboard\b/i, "Cabinets"],
  [/\bcabinet\b/i, "Cabinets"],
  [/\bnightstand\b/i, "Cabinets"],
  // Bedroom Furniture
  [/\bheadboard\b/i, "Headboards"],
  // Décor
  [/\bmirror\b/i, "Mirrors"],
  [/\bvase\b/i, "Vases & Vessels"],
  [/\bvessel\b/i, "Vases & Vessels"],
  [/\bcandle\s*holder\b/i, "Candle Holders"],
  [/\bsculptur/i, "Decorative Objects"],
  // Rugs
  [/\brug\b/i, "Hand-Knotted Rugs"],
  [/\bcarpet\b/i, "Hand-Knotted Rugs"],
];

// Category-level defaults when no title match and no subcategory
const CATEGORY_DEFAULT_SUBCATEGORY: Record<string, string> = {
  Rugs: "Hand-Knotted Rugs",
  Lighting: "Table Lights",
  Storage: "Cabinets",
  "Bedroom Furniture": "Headboards",
  Décor: "Decorative Objects",
  Seating: "Chairs",
  Tables: "Side Tables",
};

function inferSubcategoryFromTitle(title: string): string | undefined {
  for (const [pattern, sub] of TITLE_SUBCATEGORY_HINTS) {
    if (pattern.test(title)) return sub;
  }
  return undefined;
}

// Set of all canonical subcategory values (values in SUBCATEGORY_MAP)
const ALL_CANONICAL_SUBCATEGORIES = new Set(
  Object.values(SUBCATEGORY_MAP).flat()
);

/**
 * When subcategory is missing, try to derive it from the raw category value
 * or from the product title as a last resort, then fall back to the category default.
 */
export function inferSubcategory(rawCategory?: string, rawSubcategory?: string, title?: string): string {
  if (rawSubcategory) {
    const normalized = normalizeSubcategory(rawSubcategory) || rawSubcategory;
    if (ALL_CANONICAL_SUBCATEGORIES.has(normalized)) {
      return normalized;
    }
    // Non-canonical subcategory — fall through to title inference
  }
  // Try title-based inference first
  if (title) {
    const fromTitle = inferSubcategoryFromTitle(title);
    if (fromTitle) return fromTitle;
  }
  if (!rawCategory) return "Decorative Objects";
  // If raw category is actually a subcategory name, use it
  const normalized = SUBCATEGORY_NORMALIZE[rawCategory] || rawCategory;
  const parent = findParentCategory(rawCategory);
  if (parent) return normalized;
  // Use category-level default
  const resolvedCat = CATEGORY_NORMALIZE[rawCategory] || rawCategory;
  return CATEGORY_DEFAULT_SUBCATEGORY[resolvedCat] || "Decorative Objects";
}

export function getSubcategoriesForCategory(category: string): string[] {
  return SUBCATEGORY_MAP[category] || [];
}
