export interface ComparatorSwatch { id: string; name: string; imageUrl?: string | null; color?: string | null }
export const COMPARATOR_VISIBLE_SWATCHES = 6;
const key = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();

/** Real linked samples first; unmatched recorded materials stay explicitly unpictured. */
export function comparatorSwatches(materials: string | null | undefined, linked: ComparatorSwatch[]): ComparatorSwatch[] {
  const seen = new Set<string>();
  const result: ComparatorSwatch[] = [];
  for (const swatch of linked) {
    if (!swatch.name.trim() || seen.has(key(swatch.name))) continue;
    seen.add(key(swatch.name)); result.push(swatch);
  }
  for (const name of (materials || "").split(/\r?\n|\s*[•·;]\s*/).map(v => v.trim()).filter(Boolean)) {
    if (seen.has(key(name))) continue;
    seen.add(key(name));
    const color = name.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i)?.[0] ?? null;
    result.push({ id: `material:${key(name)}`, name, color });
  }
  return result;
}

export function splitComparatorSwatches(swatches: ComparatorSwatch[]) {
  return { visible: swatches.slice(0, COMPARATOR_VISIBLE_SWATCHES), more: swatches.slice(COMPARATOR_VISIBLE_SWATCHES) };
}