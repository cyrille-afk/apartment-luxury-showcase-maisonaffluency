import { comparatorSwatches, type ComparatorSwatch } from "./comparatorSwatches";

export type ComparatorFacetKind = "material" | "finish" | "color";
export type ComparatorFacets = Record<ComparatorFacetKind, string[]>;
export type ComparatorFacetSelection = Partial<Record<ComparatorFacetKind, string>>;

const VOCAB: Record<ComparatorFacetKind, string[]> = {
  material: ["oak", "walnut", "ash", "beech", "teak", "cherry", "maple", "elm", "wood", "brass", "bronze", "steel", "iron", "aluminium", "aluminum", "copper", "metal", "marble", "travertine", "stone", "granite", "onyx", "glass", "crystal", "leather", "suede", "fabric", "velvet", "boucle", "bouclé", "linen", "wool", "cotton", "silk", "mohair", "rattan", "cane", "ceramic", "resin", "concrete", "parchment", "shagreen"],
  finish: ["lacquered", "lacquer", "matte", "matt", "gloss", "glossy", "polished", "brushed", "patinated", "patina", "satin", "oiled", "varnished", "waxed", "burnished", "stained", "smoked", "aged", "antique", "gilded", "honed", "sandblasted", "textured", "natural"],
  color: ["black", "white", "ivory", "cream", "beige", "sand", "grey", "gray", "taupe", "brown", "tobacco", "cognac", "caramel", "green", "jade", "olive", "blue", "navy", "red", "terracotta", "rust", "pink", "nude", "yellow", "ochre", "orange", "gold", "silver", "dark", "light"],
};

const fold = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const title = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const CANON: Record<string, string> = { gray: "grey", aluminum: "aluminium", matt: "matte", lacquer: "lacquered", glossy: "gloss", patina: "patinated", "boucle": "bouclé" };

/** Classify recorded materials and linked finish names into material / finish / colour facet values. */
export function comparatorFacets(materials: string | null | undefined, linked: ComparatorSwatch[] = []): ComparatorFacets {
  const out: Record<ComparatorFacetKind, Set<string>> = { material: new Set(), finish: new Set(), color: new Set() };
  for (const swatch of comparatorSwatches(materials, linked)) {
    const words = new Set(fold(swatch.name).split(/[^a-z]+/).filter(Boolean));
    for (const kind of Object.keys(VOCAB) as ComparatorFacetKind[]) {
      for (const term of VOCAB[kind]) if (words.has(fold(term))) out[kind].add(title(CANON[fold(term)] ?? term));
    }
  }
  return { material: [...out.material].sort(), finish: [...out.finish].sort(), color: [...out.color].sort() };
}

export function matchesComparatorFacets(facets: ComparatorFacets, selection: ComparatorFacetSelection) {
  return (Object.keys(selection) as ComparatorFacetKind[]).every(kind => !selection[kind] || facets[kind].includes(selection[kind]!));
}
