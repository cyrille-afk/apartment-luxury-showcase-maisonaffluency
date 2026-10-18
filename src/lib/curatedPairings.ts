import type { BuyerProfile } from "@/contexts/CheckoutFormContext";

export type PairingCategory = "ceiling" | "wall" | "table-light" | "seating" | "tables" | "decor" | "storage";
export interface PairingProduct {
  id: string;
  title: string;
  brand: string;
  category?: string | null;
  subcategory?: string | null;
  image: string;
  path: string;
}

/** Editable editorial mock: complementary departments, not similar products. */
export const CURATED_PAIRING_RULES: Record<PairingCategory, PairingCategory[]> = {
  ceiling: ["wall", "tables", "decor"],
  wall: ["seating", "tables", "decor"],
  "table-light": ["tables", "seating", "decor"],
  seating: ["tables", "table-light", "decor"],
  tables: ["seating", "table-light", "decor"],
  decor: ["tables", "seating", "table-light"],
  storage: ["table-light", "seating", "decor"],
};

export function privatePairingsEnabled(profile: BuyerProfile): boolean {
  return profile === "private";
}

export function pairingCategory(product: Pick<PairingProduct, "title" | "category" | "subcategory">): PairingCategory | null {
  const value = `${product.subcategory || ""} ${product.title} ${product.category || ""}`.toLowerCase();
  if (/pendant|chandelier|ceiling|suspension/.test(value)) return "ceiling";
  if (/sconce|wall light|wall lamp/.test(value)) return "wall";
  if (/table lamp|table light/.test(value)) return "table-light";
  if (/chair|sofa|seating|stool|ottoman/.test(value)) return "seating";
  if (/table|console|desk/.test(value)) return "tables";
  if (/cabinet|sideboard|storage|buffet/.test(value)) return "storage";
  if (/decor|vase|bowl|vessel|mirror|object/.test(value)) return "decor";
  return null;
}

export function selectCuratedPairings(primary: Pick<PairingProduct, "id" | "title" | "brand" | "category" | "subcategory">, products: PairingProduct[], excludedIds: string[] = []): PairingProduct[] {
  const source = pairingCategory(primary);
  if (!source) return [];
  const excluded = new Set([primary.id, ...excludedIds]);
  const pool = products.filter((p) => p.image && !excluded.has(p.id) && p.title.toLowerCase() !== primary.title.toLowerCase());
  return CURATED_PAIRING_RULES[source].flatMap((category) => {
    const matches = pool.filter((p) => pairingCategory(p) === category);
    const sameBrand = matches.find((p) => p.brand.toLowerCase() === primary.brand.toLowerCase());
    const pick = sameBrand ?? matches[0];
    return pick ? [pick] : [];
  }).slice(0, 3);
}