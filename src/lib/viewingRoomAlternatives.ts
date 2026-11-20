import { has3dAsset } from "./visualiserCatalog";

type Taxonomy = { id: string; category: string | null; subcategory: string | null };
type Candidate = Taxonomy & { glb_url: string | null; is_active: boolean; is_hidden: boolean | null };
const terms = (value: string | null) => (value ?? "").split(/\s+\/\s+/).map(term => term.trim().toLocaleLowerCase()).filter(Boolean);
export function viewingRoomSwapsEnabled(itemSwappable: boolean, packageAllowsSwaps: boolean): boolean {
  return itemSwappable && packageAllowsSwaps;
}

/** This approval includes the category OR an explicit subcategory, not inferred tags. */
export function isApprovedViewingRoomAlternative(slot: Taxonomy, candidate: Candidate): boolean {
  if (slot.id === candidate.id || !candidate.is_active || candidate.is_hidden || !has3dAsset(candidate)) return false;
  return terms(slot.category).some(term => terms(candidate.category).includes(term))
    || terms(slot.subcategory).some(term => terms(candidate.subcategory).includes(term));
}

export function viewingRoomFootprintFits(slot: { width_mm: number | null; depth_mm: number | null }, candidate: { width_mm: number | null; depth_mm: number | null }): boolean {
  const { width_mm: w, depth_mm: d } = slot;
  const { width_mm: cw, depth_mm: cd } = candidate;
  return w != null && d != null && cw != null && cd != null && w > 0 && d > 0
    && cw * 100 >= w * 80 && cw * 100 <= w * 120 && cd * 100 >= d * 80 && cd * 100 <= d * 120;
}