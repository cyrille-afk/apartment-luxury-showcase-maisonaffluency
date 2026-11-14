import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import { findQuoteFinishSwatch, type QuoteFinishVariant } from "./quoteFinishSwatches";
import { configuredProductPrice } from "./configuredProductPrice";

export type StudioFinish = VisualiserMaterial & { tier?: string | null; framePrice?: number | null; perMetre?: number | null; currency?: string; pictured?: boolean };
export type StudioFinishSelection = { ids: Record<string, string>; locked: boolean };
export type StudioFinishProduct = { name: string; variants: QuoteFinishVariant[]; finishes: StudioFinish[]; baseLabel?: string | null; topLabel?: string | null; materials?: string | null; comMetres?: number | null };
export type StudioFinishGroup = { key: string; label: string; options: StudioFinish[] };
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const dimension = (s: string) => /\d\s*(cm|mm|inch|×)/i.test(s);
const textile = (s: string) => /fabric|upholster|textile|leather|sheepskin|velvet|boucl/i.test(s);
const matches = (finish: StudioFinish, value: string) => fold(finish.name) === fold(value) || (!!finish.tier && fold(finish.tier) === fold(value)) || findQuoteFinishSwatch([value], [finish]) != null;

/** Supplier axes and linked samples only; dimension axes are never materials. */
export function studioFinishGroups(product: StudioFinishProduct): StudioFinishGroup[] {
  const groups: StudioFinishGroup[] = [];
  const assigned = new Set<string>();
  for (const axis of ["base", "top"] as const) {
    const values = [...new Set(product.variants.map(v => v[axis]?.trim()).filter((s): s is string => !!s && !dimension(s)))];
    if (!values.length) continue;
    const recordedLabel = axis === "base" ? product.baseLabel : product.topLabel;
    const key = textile((recordedLabel || "") + " " + values.join(" ")) ? "upholstery" : axis;
    const label = recordedLabel || (key === "upholstery" ? "Upholstery" : axis === "base" ? "Frame / Base" : "Surface");
    const options = product.finishes.filter(f => values.some(v => matches(f, v)));
    // Unpictured recorded finishes remain named placeholders, not invented samples.
    for (const value of values) if (!options.some(f => matches(f, value))) options.push({ id: `catalog:${axis}:${value}`, name: value, category: textile(value) ? "Fabric" : label, brand_name: "", material_type: null, color_family: null, image_url: null });
    options.forEach(f => assigned.add(f.id));
    groups.push({ key, label, options });
  }
  for (const finish of product.finishes.filter(f => !assigned.has(f.id))) {
    const key = textile(finish.category) ? "upholstery" : /metal|wood|lacquer/i.test(finish.category) ? "base" : "top";
    let group = groups.find(g => g.key === key);
    if (!group) { group = { key, label: key === "upholstery" ? "Upholstery" : key === "base" ? "Frame / Base" : "Surface", options: [] }; groups.push(group); }
    group.options.push(finish);
  }
  return groups;
}

export function resolveStudioSelection(product: StudioFinishProduct, savedLabel: string | null, saved?: StudioFinishSelection | null): StudioFinishSelection {
  const ids: Record<string, string> = {};
  for (const group of studioFinishGroups(product)) {
    const previous = group.options.find(f => f.id === saved?.ids?.[group.key]);
    const named = savedLabel ? group.options.find(f => savedLabel.toLowerCase().includes(f.name.toLowerCase())) : null;
    const tier = savedLabel ? group.options.find(f => f.tier && savedLabel.toLowerCase().includes(f.tier.toLowerCase())) : null;
    const selected = previous ?? named ?? tier ?? group.options.find(f => f.pictured) ?? group.options[0];
    if (selected) ids[group.key] = selected.id;
  }
  return { ids, locked: saved?.locked === true };
}

export function studioSelectedFinishes(product: StudioFinishProduct, selection: StudioFinishSelection) {
  return studioFinishGroups(product).flatMap(group => {
    const finish = group.options.find(f => f.id === selection.ids[group.key]);
    return finish ? [{ key: group.key, finish }] : [];
  });
}

/** Respect saved size, compatible axis pairs, frame overrides and per-metre upholstery. */
export function studioFinishPrice(product: StudioFinishProduct, selection: StudioFinishSelection, fallback: number | null, savedLabel: string | null, convert: (cents: number, currency?: string) => number): number | null {
  const selected = studioSelectedFinishes(product, selection);
  const size = product.variants.find(v => [v.base, v.label].some(value => value && dimension(value) && savedLabel?.includes(value)));
  const compatible = product.variants.filter(v => (!size || v.base === size.base) && selected.every(({ key, finish }) => {
    const value = key === "base" ? v.base : v.top;
    return !value || dimension(value) || matches(finish, value);
  }));
  const variant = compatible[0];
  const frame = selected.find(({ key, finish }) => key === "base" && (finish.framePrice ?? 0) > 0)?.finish;
  const base = frame?.framePrice ? convert(frame.framePrice, frame.currency) : variant?.price_cents ?? fallback;
  if (base == null) return null;
  const fabric = selected.find(({ key }) => key === "upholstery")?.finish;
  const metres = (variant as QuoteFinishVariant & { meters?: number } | undefined)?.meters ?? product.comMetres;
  const surcharge = fabric?.perMetre && metres ? convert(Math.round(fabric.perMetre * metres), fabric.currency) : 0;
  return configuredProductPrice(base, surcharge, 0).retailCents;
}

/** Only real linked textures override GLB materials; unknown samples retain authored surfaces. */
export function studioAppearance(product: StudioFinishProduct, selection: StudioFinishSelection) {
  const selected = studioSelectedFinishes(product, selection);
  const appearance: Record<string, unknown> = { finishesLocked: selection.locked, finishes: selected.map(s => s.finish.name), partMaterials: {} };
  for (const { key, finish } of selected) {
    if (!finish.image_url && !finish.color) continue;
    const material = { ...finish, target: key === "upholstery" ? "upholstery" : key === "base" ? "base" : "top", diffuse_url: finish.diffuse_url || finish.image_url, roughness: key === "upholstery" ? .92 : .55, metalness: /metal/i.test(finish.category) ? .65 : 0 };
    appearance[key === "upholstery" ? "upholsteryMaterial" : key === "base" ? "baseMaterial" : "topMaterial"] = material;
    if (key === "base") appearance.partMaterials = { frame: { ...material, target: "frame" } };
  }
  return appearance;
}