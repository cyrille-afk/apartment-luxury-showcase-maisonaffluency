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
export type FinishFacetOverride = Partial<Record<ComparatorFacetKind, string | null>>;
export const finishFacetKey = (name: string) => fold(name).replace(/\s+/g, " ").trim();
export const FACET_VOCAB_OPTIONS: Record<ComparatorFacetKind, string[]> = Object.fromEntries((Object.keys(VOCAB) as ComparatorFacetKind[]).map(k => [k, [...new Set(VOCAB[k].map(t => title(CANON[fold(t)] ?? t)))].sort()])) as Record<ComparatorFacetKind, string[]>;

/** Every distinct finish/material name for a piece, for admin categorisation. */
export function comparatorFinishNames(materials: string | null | undefined, linked: ComparatorSwatch[] = []) {
  return comparatorSwatches(materials, linked).map(s => s.name);
}

export function comparatorFacets(materials: string | null | undefined, linked: ComparatorSwatch[] = [], overrides?: Map<string, FinishFacetOverride>): ComparatorFacets {
  const out: Record<ComparatorFacetKind, Set<string>> = { material: new Set(), finish: new Set(), color: new Set() };
  for (const swatch of comparatorSwatches(materials, linked)) {
    const override = overrides?.get(finishFacetKey(swatch.name));
    for (const kind of Object.keys(VOCAB) as ComparatorFacetKind[]) { const v = override?.[kind]?.trim(); if (v) out[kind].add(title(v)); }
    const words = new Set(fold(swatch.name).split(/[^a-z]+/).filter(Boolean));
    for (const kind of Object.keys(VOCAB) as ComparatorFacetKind[]) {
      if (override?.[kind]?.trim()) continue;
      for (const term of VOCAB[kind]) if (words.has(fold(term))) out[kind].add(title(CANON[fold(term)] ?? term));
    }
  }
  return { material: [...out.material].sort(), finish: [...out.finish].sort(), color: [...out.color].sort() };
}

/** Top-level material families; each specific material belongs to exactly one. */
export const MATERIAL_TAXONOMY: Record<string, string[]> = {
  Wood: ["Ash", "Beech", "Cherry", "Elm", "Maple", "Oak", "Teak", "Walnut"],
  Metal: ["Aluminium", "Brass", "Bronze", "Copper", "Iron", "Steel"],
  Fabric: ["Bouclé", "Cotton", "Linen", "Mohair", "Silk", "Velvet", "Wool"],
  Leather: ["Shagreen", "Suede"],
  Stone: ["Granite", "Marble", "Onyx", "Travertine"],
  Glass: ["Crystal"],
};
const PARENT_ORDER = [...Object.keys(MATERIAL_TAXONOMY), "Other"];
const PARENT_BY_TYPE = new Map(Object.entries(MATERIAL_TAXONOMY).flatMap(([parent, kids]) => [[fold(parent), parent], ...kids.map(k => [fold(k), parent] as [string, string])]));
/** Base family for a material facet value ("Oak" → "Wood", "Wood" → "Wood"); unknown values fall under "Other". */
export const materialParent = (value: string) => PARENT_BY_TYPE.get(fold(value)) ?? "Other";
/** Base families present among the given material facet values, in taxonomy order. */
export function materialParentOptions(materials: string[]) {
  const present = new Set(materials.map(materialParent));
  return PARENT_ORDER.filter(p => present.has(p));
}
/** Specific types under a family present among the values (the family's own generic name is excluded). */
export function materialTypeOptions(materials: string[], parent: string) {
  return [...new Set(materials.filter(m => materialParent(m) === parent && fold(m) !== fold(parent)))].sort((a, b) => a.localeCompare(b));
}

/** Material selection is hierarchical: a family (e.g. "Wood") matches every type under it; `materialType` narrows to one. */
export function matchesComparatorFacets(facets: ComparatorFacets, selection: ComparatorFacetSelection & { materialType?: string }) {
  const { materialType, ...rest } = selection;
  if (rest.material && !facets.material.some(m => materialParent(m) === rest.material || m === rest.material)) return false;
  if (materialType && !facets.material.includes(materialType)) return false;
  return (["finish", "color"] as const).every(kind => !rest[kind] || facets[kind].includes(rest[kind]!));
}

/** Merge unsaved draft categories into the override map the filters would use. A row left with all three boxes empty falls back to the automatic guess. */
export function mergeFacetOverrides(drafts: Record<string, FinishFacetOverride | undefined>) {
  const out = new Map<string, FinishFacetOverride>();
  for (const [name, d] of Object.entries(drafts)) {
    const has = d && Object.values(d).some(v => v && String(v).trim());
    out.set(finishFacetKey(name), has ? { material: d!.material?.trim() || null, finish: d!.finish?.trim() || null, color: d!.color?.trim() || null } : {});
  }
  return out;
}

/** Which compared pieces each facet filter would show with the given overrides. */
export function previewFacetGroups(pieces: { name: string; materials: string | null; linked?: ComparatorSwatch[] }[], overrides: Map<string, FinishFacetOverride>) {
  const groups: Record<ComparatorFacetKind, Map<string, string[]>> = { material: new Map(), finish: new Map(), color: new Map() };
  for (const piece of pieces) {
    const facets = comparatorFacets(piece.materials, piece.linked ?? [], overrides);
    for (const kind of Object.keys(VOCAB) as ComparatorFacetKind[]) {
      for (const v of facets[kind]) {
        const list = groups[kind].get(v) ?? [];
        if (!list.includes(piece.name)) list.push(piece.name);
        groups[kind].set(v, list);
      }
    }
  }
  return Object.fromEntries((Object.keys(groups) as ComparatorFacetKind[]).map(kind => [kind, [...groups[kind].entries()].map(([value, pieces]) => ({ value, pieces })).sort((a, b) => a.value.localeCompare(b.value))])) as Record<ComparatorFacetKind, { value: string; pieces: string[] }[]>;
}
