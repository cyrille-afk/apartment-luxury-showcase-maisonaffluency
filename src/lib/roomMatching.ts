// Shared catalogue matching helpers — single source of truth for the Shop by
// Room grid (ProductGrid) and the navigation mega-menu count badges.
// Extracted from src/components/ProductGrid.tsx so menu counts and grid
// filtering can never drift apart.
import type { CuratorPick } from "@/components/FeaturedDesigners";
import { ROOM_MAP, type RoomSlug } from "@/lib/roomCategories";
import { inferSubcategory } from "@/lib/productTaxonomy";

export function normalizeLabel(value?: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(\w+?)s\b/g, "$1");
}

export function labelsMatch(a?: string, b?: string): boolean {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Stricter match for top-level categories — requires full-word boundary match
 *  to prevent "Table Lamp" from matching the "Tables" category. */
export function categoryMatch(pickValue?: string, category?: string): boolean {
  const na = normalizeLabel(pickValue);
  const nb = normalizeLabel(category);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Check word-boundary match: "table" should match "table" but not "table lamp"
  const regex = new RegExp(`(^|\\s)${nb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
  return regex.test(na);
}

/** Map top-level categories to the set of subcategory tags they contain,
 *  so "Tables" only matches Table-related subs, not "Table Lamp". */
export const CATEGORY_SUBCATS: Record<string, string[]> = {
  "Seating": ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools"],
  "Tables": ["Consoles", "Coffee Tables", "Desks", "Dining Tables", "Side Tables", "Centre Tables"],
  "Storage": ["Bookcases", "Bars", "Buffets, Cabinets And Sideboards"],
  "Bedroom": ["Bedding", "Beds", "Bedside Tables", "Sofa-Beds"],
  "Lighting": ["Wall Lights", "Ceiling Lights", "Floor Lights", "Table Lights"],
  "Rugs": ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"],
  "Décor": ["Vases & Vessels", "Mirrors", "Books", "Boxes", "Candle Holders", "Cushions & Throws", "Decorative Objects", "Desk Accessories", "Tableware & Linens", "Wall Décor"],
};

export const SUB_TAGS: Record<string, string[]> = {
  "Sofas": ["Sofa"], "Armchairs": ["Armchair", "Armchairs"], "Chairs": ["Chair"],
  "Daybeds & Benches": ["Daybed", "Bench"], "Ottomans & Stools": ["Ottoman", "Stool"],
  "Bar Stools": ["Bar Stool"], "Consoles": ["Console"], "Coffee Tables": ["Coffee Table"],
  "Desks": ["Desk"], "Dining Tables": ["Dining Table"], "Side Tables": ["Side Table"],
  "Wall Lights": ["Wall Light", "Wall Lamp", "Sconce"], "Ceiling Lights": ["Ceiling Light", "Chandelier", "Pendant", "Suspension"],
  "Floor Lights": ["Floor Light", "Floor Lamp"], "Table Lights": ["Table Light", "Table Lamp", "Lantern"],
  "Bookcases": ["Bookcase"], "Cabinets": ["Cabinet"],
  "Hand-Knotted Rugs": ["Hand-Knotted Rug", "Textile"], "Hand-Tufted Rugs": ["Hand-Tufted Rug"],
  "Hand-Woven Rugs": ["Hand-Woven Rug"], "Vases & Vessels": ["Vase", "Vessel"],
  "Mirrors": ["Mirror"], "Books": ["Book"], "Candle Holders": ["Candle Holder"],
  "Decorative Objects": ["Decorative Object", "Object", "Sculpture"],
  "Centre Tables": ["Centre Table"],
};

export function pickMatchesFilter(pick: CuratorPick, category: string | null, subcategory: string | null): boolean {
  if (!category && !subcategory) return true;

  // Resolve effective subcategory using title-based inference as fallback,
  // so picks with only a top-level category (e.g. "Tables") still match
  // specific subcategory filters (e.g. "Coffee Tables") via their title.
  const inferenceText = [pick.title, pick.subtitle].filter(Boolean).join(" ");
  const effectiveSub = inferSubcategory(pick.category, pick.subcategory, inferenceText);

  if (subcategory) {
    const tags = SUB_TAGS[subcategory] || [subcategory];
    return tags.some(tag =>
      categoryMatch(pick.subcategory, tag) ||
      categoryMatch(pick.subcategory, subcategory) ||
      categoryMatch(pick.category, tag) ||
      (pick.tags && pick.tags.some(t => categoryMatch(t, tag))) ||
      categoryMatch(effectiveSub, tag) ||
      categoryMatch(effectiveSub, subcategory)
    );
  }
  // Top-level category: match against all its subcategory tags to avoid false positives
  const subs = CATEGORY_SUBCATS[category!];
  if (subs) {
    return subs.some(sub => {
      const tags = SUB_TAGS[sub] || [sub];
      return tags.some(tag =>
        categoryMatch(pick.subcategory, tag) ||
        categoryMatch(pick.subcategory, sub) ||
        categoryMatch(pick.category, tag) ||
        (pick.tags && pick.tags.some(t => categoryMatch(t, tag))) ||
        categoryMatch(effectiveSub, tag) ||
        categoryMatch(effectiveSub, sub)
      );
    });
  }
  // Fallback: exact category match only (no tag matching to prevent cross-category leaks)
  return categoryMatch(pick.category, category || undefined) || false;
}

export const ROOM_CATEGORY_ALIASES: Record<string, string[]> = {
  sofas: ["Sofas"],
  armchairs: ["Armchairs"],
  daybeds: ["Daybeds & Benches", "Daybed"],
  benches: ["Daybeds & Benches", "Bench"],
  "coffee-tables": ["Coffee Tables"],
  "side-tables": ["Side Tables"],
  credenzas: ["Buffets, Cabinets And Sideboards", "Credenza", "Sideboard"],
  rugs: ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs", "Rug"],
  "floor-lights": ["Floor Lights"],
  "dining-tables": ["Dining Tables"],
  chairs: ["Chairs"],
  "bar-stools": ["Ottomans & Stools", "Bar Stool"],
  "ceiling-lights": ["Ceiling Lights"],
  beds: ["Beds"],
  nightstands: ["Bedside Tables", "Nightstand"],
  dressers: ["Dresser"],
  wardrobes: ["Wardrobe"],
  "table-lights": ["Table Lights"],
  desks: ["Desks"],
  "office-chairs": ["Office Chair", "Desk Chair"],
  bookcases: ["Bookcases"],
};

export function pickMatchesRoom(pick: CuratorPick, room: RoomSlug): boolean {
  const inferenceText = [pick.title, pick.subtitle].filter(Boolean).join(" ");
  const effectiveSub = inferSubcategory(pick.category, pick.subcategory, inferenceText);
  const values = [pick.category, pick.subcategory, effectiveSub, pick.title, ...(pick.tags || [])];

  return ROOM_MAP[room].some((roomCategory) =>
    (ROOM_CATEGORY_ALIASES[roomCategory] || [roomCategory]).some((alias) =>
      values.some((value) => categoryMatch(value, alias)),
    ),
  );
}
