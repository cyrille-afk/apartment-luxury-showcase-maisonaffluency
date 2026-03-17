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

let _cachedProducts: TradeProduct[] | null = null;

export function getAllTradeProducts(): TradeProduct[] {
  if (_cachedProducts) return _cachedProducts;

  const products: TradeProduct[] = [];
  let idx = 0;

  const addPicks = (brandName: string, picks: CuratorPick[]) => {
    for (const pick of picks) {
      if (!pick.title) continue;
      products.push({
        id: `tp-${idx++}`,
        brand_name: brandName,
        product_name: pick.title,
        subtitle: pick.subtitle,
        category: pick.category || pick.tags?.[0] || "Uncategorized",
        subcategory: pick.subcategory || pick.tags?.[1],
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
