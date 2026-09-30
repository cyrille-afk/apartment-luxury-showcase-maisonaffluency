/** Editorial material groups for the public room collection. A group only matches
 * when the pick's own published material description explicitly supports it. */
export const ROOM_MATERIAL_CATEGORIES = [
  "Blackened Steel",
  "Brass",
  "Bronze",
  "Ceramic, Porcelain & Terracotta",
  "Glass",
  "Glass & Mirror",
  "Gold Leaf",
  "Lacquer",
  "Leather & Sheepskin",
  "Marble & Travertine",
  "Metal",
  "Mirror",
  "Mother Of Pearl",
  "Onyx & Alabaster",
  "Plaster",
  "Rattan",
  "Resin",
  "Stainless Steel",
  "Straw Marquetry",
  "Upholstery",
  "Wood",
] as const;

const word = (text: string, pattern: string) => new RegExp(`\\b(?:${pattern})\\b`, "i").test(text);

export function roomMaterialCategories(materials?: string | null, title?: string | null): string[] {
  // Classify on materials + title: mirrors/lighting often carry the material
  // only in the name ("Hublot Mirror", "Shadow Drawings Mirror"), and some
  // catalogued pieces have no materials text at all.
  const combined = [materials, title].filter(Boolean).join(" \u2022 ");
  if (!combined.trim()) return [];
  const m = combined.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const glass = word(m, "glass");
  // "Mirror-polished steel" describes a finish, not an actual mirror.
  const mirror = word(m, "mirror(?:ed)?") && !/\bmirror[- ]polished\b/i.test(m);
  const matched: string[] = [];
  const add = (label: string, yes: boolean) => { if (yes) matched.push(label); };
  add("Blackened Steel", /\bblackened\s+steel\b/i.test(m));
  add("Brass", word(m, "brass"));
  add("Bronze", word(m, "bronze"));
  add("Ceramic, Porcelain & Terracotta", word(m, "ceramic|porcelain|terracotta|terra cotta|earthenware"));
  add("Glass", glass);
  add("Glass & Mirror", glass && mirror);
  add("Gold Leaf", /\bgold\s+leaf\b/i.test(m));
  add("Lacquer", word(m, "lacquer(?:ed)?"));
  add("Leather & Sheepskin", word(m, "leather|sheepskin|shearling|hide|suede|shagreen"));
  add("Marble & Travertine", word(m, "marble|travertine"));
  add("Metal", word(m, "metal|steel|brass|bronze|copper|iron|aluminium|aluminum|nickel"));
  add("Mirror", mirror);
  add("Mother Of Pearl", /\bmother\s+of\s+pearl\b|\bnacre\b/i.test(m));
  add("Onyx & Alabaster", word(m, "onyx|alabaster|alalbaster"));
  add("Plaster", word(m, "plaster"));
  add("Rattan", word(m, "rattan"));
  add("Resin", word(m, "resin|resine"));
  add("Stainless Steel", /\bstainless\s+steel\b/i.test(m));
  add("Straw Marquetry", /\bstraw\s+marquetry\b/i.test(m));
  add("Upholstery", word(m, "upholster(?:y|ed|ing)?|fabric|velvet|boucle|linen|mohair"));
  add("Wood", word(m, "wood|wooden|oak|walnut|ash|beech|elm|ebony|timber|teak|plywood|veneer|sycamore"));
  return matched;
}