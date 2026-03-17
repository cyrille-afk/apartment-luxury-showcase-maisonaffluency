/**
 * Aggregates all curator picks from FeaturedDesigners, Collectibles, and BrandsAteliers
 * into a flat product list for the Trade Gallery.
 */
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";
import { atelierOnlyPicks } from "@/components/BrandsAteliers";

export interface TradeProduct {
  id: string;
  brand_name: string;
  product_name: string;
  subtitle?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  materials?: string;
  dimensions?: string;
  description?: string;
  image_url: string | null;
  hover_image_url?: string;
  edition?: string;
  pdf_url?: string;
  pdf_urls?: { label: string; url: string; filename?: string }[];
}

// Map non-canonical subcategory values to their canonical (plural) form
const SUBCATEGORY_NORMALIZE: Record<string, string> = {
  "Console": "Consoles",
  "Coffee Table": "Coffee Tables",
  "Dining Table": "Dining Tables",
  "Side Table": "Side Tables",
  "Desk": "Desks",
  "Cabinet": "Cabinets",
  "Bookcase": "Bookcases",
  "Bookcases & Credenzas": "Bookcases",
  "Sofa": "Sofas",
  "Armchair": "Armchairs",
  "Chair": "Chairs",
  "Bar Stool": "Bar Stools",
  "Ottoman": "Ottomans & Stools",
  "Stool": "Ottomans & Stools",
  "Stools": "Ottomans & Stools",
  "Daybed": "Daybeds & Benches",
  "Bench": "Daybeds & Benches",
  "Wall Light": "Wall Lights",
  "Ceiling Light": "Ceiling Lights",
  "Floor Light": "Floor Lights",
  "Floor Lamp": "Floor Lights",
  "Floor Lamps": "Floor Lights",
  "Table Light": "Table Lights",
  "Table Lamp": "Table Lights",
  "Table Lamps": "Table Lights",
  "Pendant": "Ceiling Lights",
  "Pendants": "Ceiling Lights",
  "Chandelier": "Ceiling Lights",
  "Chandeliers": "Ceiling Lights",
  "Vase": "Vases & Vessels",
  "Vases": "Vases & Vessels",
  "Vessel": "Vases & Vessels",
  "Vessels": "Vases & Vessels",
  "Mirror": "Mirrors",
  "Book": "Books",
  "Candle Holder": "Candle Holders",
  "Decorative Object": "Decorative Objects",
  "Sculptural Object": "Decorative Objects",
  "Tableware": "Decorative Objects",
  "Sideboards": "Cabinets",
  "Sideboard": "Cabinets",
  "Hand-Knotted Rug": "Hand-Knotted Rugs",
  "Hand-Tufted Rug": "Hand-Tufted Rugs",
  "Hand-Woven Rug": "Hand-Woven Rugs",
  "Wallcoverings": "Decorative Objects",
};

// Map non-canonical category values to canonical ones
const CATEGORY_NORMALIZE: Record<string, string> = {
  "Decorative Object": "Décor",
  "Decorative Objects": "Décor",
  "Furniture": "Tables",
  "Wall Art": "Décor",
};

function normalizeCategory(cat: string): string {
  return CATEGORY_NORMALIZE[cat] || cat;
}

function normalizeSubcategory(sub: string | undefined): string | undefined {
  if (!sub) return sub;
  return SUBCATEGORY_NORMALIZE[sub] || sub;
}

let _cachedProducts: TradeProduct[] | null = null;

export function getAllTradeProducts(): TradeProduct[] {
  if (_cachedProducts) return _cachedProducts;

  const products: TradeProduct[] = [];
  let idx = 0;

  const addPicks = (brandName: string, picks: CuratorPick[]) => {
    for (const pick of picks) {
      if (!pick.title) continue;
      const rawCategory = pick.category || pick.tags?.[0] || "Uncategorized";
      products.push({
        id: `tp-${idx++}`,
        brand_name: brandName,
        product_name: pick.title,
        subtitle: pick.subtitle,
        category: normalizeCategory(rawCategory),
        subcategory: normalizeSubcategory(pick.subcategory || pick.tags?.[1]),
        tags: pick.tags || [],
        materials: pick.materials,
        dimensions: pick.dimensions,
        description: pick.description,
        image_url: pick.image || null,
        hover_image_url: pick.hoverImage,
        edition: pick.edition,
        pdf_url: pick.pdfUrl,
        pdf_urls: pick.pdfUrls,
      });
    }
  };

  // Featured Designers
  for (const designer of featuredDesigners) {
    if (designer.curatorPicks?.length) {
      addPicks(designer.name, designer.curatorPicks);
    }
  }

  // Collectible Designers
  for (const designer of collectibleDesigners) {
    if (designer.curatorPicks?.length) {
      addPicks(designer.name, designer.curatorPicks);
    }
  }

  // Atelier-only picks
  for (const [, data] of Object.entries(atelierOnlyPicks)) {
    if (data.curatorPicks?.length) {
      addPicks(data.name, data.curatorPicks);
    }
  }

  _cachedProducts = products;
  return products;
}

export const CATEGORY_ORDER = ["Seating", "Tables", "Lighting", "Storage", "Rugs", "Décor"];

export const SUBCATEGORY_MAP: Record<string, string[]> = {
  "Seating": ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools", "Bar Stools"],
  "Tables": ["Consoles", "Coffee Tables", "Desks", "Dining Tables", "Side Tables"],
  "Lighting": ["Wall Lights", "Ceiling Lights", "Floor Lights", "Table Lights"],
  "Storage": ["Bookcases", "Cabinets"],
  "Rugs": ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"],
  "Décor": ["Vases & Vessels", "Mirrors", "Books", "Candle Holders", "Decorative Objects"],
};

export function getAllBrands(products: TradeProduct[]): string[] {
  return [...new Set(products.map((p) => p.brand_name))].sort();
}

export function getAllCategories(_products?: TradeProduct[]): string[] {
  return [...CATEGORY_ORDER];
}

export function getSubcategories(_products: TradeProduct[], category: string): string[] {
  return SUBCATEGORY_MAP[category] || [];
}
