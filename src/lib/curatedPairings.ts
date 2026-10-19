import type { BuyerProfile } from "@/contexts/CheckoutFormContext";
import { parsePairingFinishOptions, type PairingFinishOption } from "./pairingFinishPricing";
import { parsePairingMedia, type PairingMedia } from './pairingMedia';
import { pairingRoomKey, pairingRoomSlots } from './pairingRooms';

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
  pairingRuleId?: string;
  finishOptions?: PairingFinishOption[];
  finishCurrency?: string;
  finishMedia?: PairingMedia[];
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
  finish_options?: unknown;
  finish_currency?: string;
  finish_media?: unknown;
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

function pairingSeed(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function selectCuratedPairings(primary: Pick<PairingProduct, "id" | "title" | "brand" | "category" | "subcategory">, products: PairingProduct[], excludedIds: string[] = [], rules: PairingRule[] = []): PairingProduct[] {
  const source = pairingCategory(primary);
  if (!source) return [];
  const excluded = new Set([primary.id, ...excludedIds]);
  const pool = products.filter((p) => p.image && !excluded.has(p.id) && p.title.toLowerCase() !== primary.title.toLowerCase());
  const roomSlots = pairingRoomSlots(primary);
  return rules.filter((r) => r.source_category === source)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)).flatMap((rule, index) => {
    if (!rule.enabled || (!roomSlots && rule.target_category === source)) return [];
    const slot = roomSlots?.[index];
    if (roomSlots && !slot?.length) return [];
    const matches = pool.filter((p) => !excluded.has(p.id) && (slot
      ? slot.includes(pairingRoomKey(p) || "")
      : pairingCategory(p) === rule.target_category));
    // Rotate deterministically per purchased piece so each first choice gets its own companions.
    const ranked = [...matches].sort((a, b) => (slot ? slot.indexOf(pairingRoomKey(a) || "") - slot.indexOf(pairingRoomKey(b) || "") : 0) || pairingSeed(primary.id + a.id) - pairingSeed(primary.id + b.id) || a.id.localeCompare(b.id));
    const sameBrand = ranked.find((p) => p.brand.toLowerCase() === primary.brand.toLowerCase());
    const pick = matches.find((p) => p.id === rule.preferred_pick_id) ?? sameBrand ?? ranked[0];
    if (pick) excluded.add(pick.id);
    return pick ? [{ ...pick, ...(pick.id === rule.preferred_pick_id ? { finishMedia: parsePairingMedia(rule.finish_media) } : {}), ...(pick.id === rule.preferred_pick_id && parsePairingFinishOptions(rule.finish_options).length ? {
      pairingRuleId: rule.id, finishOptions: parsePairingFinishOptions(rule.finish_options), finishCurrency: rule.finish_currency || "USD",
    } : {}) }] : [];
  }).slice(0, 3);
}