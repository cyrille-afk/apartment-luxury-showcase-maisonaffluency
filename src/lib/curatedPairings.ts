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
  materials?: string | null;
  leadTime?: string | null;
  origin?: string | null;
}

export const PAIRING_CATEGORIES: Record<PairingCategory, string> = {
  ceiling: "Ceiling lighting", wall: "Wall lighting", "table-light": "Table lighting",
  seating: "Seating", tables: "Tables & consoles", decor: "Decor", storage: "Storage",
};
export interface PairingRule {
  id: string;
  source_category: string;
  target_category: string;
  preferred_pick_id: string | null;
  sort_order: number;
  enabled: boolean;
}

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

export function selectCuratedPairings(primary: Pick<PairingProduct, "id" | "title" | "brand" | "category" | "subcategory">, products: PairingProduct[], excludedIds: string[] = [], rules: PairingRule[] = []): PairingProduct[] {
  const source = pairingCategory(primary);
  if (!source) return [];
  const excluded = new Set([primary.id, ...excludedIds]);
  const pool = products.filter((p) => p.image && !excluded.has(p.id) && p.title.toLowerCase() !== primary.title.toLowerCase());
  return rules.filter((r) => r.enabled && r.source_category === source && r.target_category !== source)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)).flatMap((rule) => {
    const matches = pool.filter((p) => pairingCategory(p) === rule.target_category && !excluded.has(p.id));
    const sameBrand = matches.find((p) => p.brand.toLowerCase() === primary.brand.toLowerCase());
    const pick = matches.find((p) => p.id === rule.preferred_pick_id) ?? sameBrand ?? matches[0];
    if (pick) excluded.add(pick.id);
    return pick ? [pick] : [];
  }).slice(0, 3);
}