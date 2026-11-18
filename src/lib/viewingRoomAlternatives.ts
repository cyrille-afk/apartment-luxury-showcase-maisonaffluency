import { has3dAsset } from "./visualiserCatalog";

type Taxonomy = { id: string; category: string | null; subcategory: string | null };
type Candidate = Taxonomy & { glb_url: string | null; is_active: boolean; is_hidden: boolean | null };
const terms = (value: string | null) => (value ?? "").split(/\s+\/\s+/).map(term => term.trim().toLocaleLowerCase()).filter(Boolean);

/** This approval includes the category OR an explicit subcategory, not inferred tags. */
export function isApprovedViewingRoomAlternative(slot: Taxonomy, candidate: Candidate): boolean {
  if (slot.id === candidate.id || !candidate.is_active || candidate.is_hidden || !has3dAsset(candidate)) return false;
  return terms(slot.category).some(term => terms(candidate.category).includes(term))
    || terms(slot.subcategory).some(term => terms(candidate.subcategory).includes(term));
}