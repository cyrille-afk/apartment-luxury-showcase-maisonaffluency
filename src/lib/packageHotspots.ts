import { z } from "zod";

export const hotspotAlternativeSchema = z.object({
  id: z.string(), name: z.string(), image: z.string().nullable(), category_role: z.string(),
  width_m: z.number().nullable(), depth_m: z.number().nullable(), height_m: z.number().nullable(), base_price_sgd: z.number().nullable(),
});
export const packageHotspotsSchema = z.array(hotspotAlternativeSchema.omit({ category_role: true }).extend({
  name: z.string().nullable(), catalog_id: z.string().nullable(), category_role: z.string().nullable(),
  is_swappable: z.boolean(), allow_finish_customization: z.boolean(), pinned_alternative_ids: z.array(z.string()),
  alternatives: z.array(hotspotAlternativeSchema),
}));
export type PackageHotspot = z.infer<typeof packageHotspotsSchema>[number];
export type HotspotAlternative = z.infer<typeof hotspotAlternativeSchema>;

export function compatibleHotspotAlternative(source: { id: string; category_role: string | null; width_m: number | null; depth_m: number | null }, alternative: { id: string; category_role: string | null; width_m: number | null; depth_m: number | null }) {
  if (source.id === alternative.id || !source.category_role || source.category_role !== alternative.category_role) return false;
  if (!source.width_m || !source.depth_m || !alternative.width_m || !alternative.depth_m || source.width_m <= 0 || source.depth_m <= 0) return false;
  return alternative.width_m >= source.width_m * .85 && alternative.width_m <= source.width_m * 1.15 && alternative.depth_m >= source.depth_m * .85 && alternative.depth_m <= source.depth_m * 1.15;
}
export function hotspotPinsError(slot: Pick<PackageHotspot, "is_swappable" | "pinned_alternative_ids" | "alternatives">) {
  const pins = slot.pinned_alternative_ids;
  if (new Set(pins).size !== pins.length || pins.length > 4 || (slot.is_swappable && pins.length < 2)) return "Select 2–4 approved options for each enabled swap.";
  if (pins.some(id => !slot.alternatives.some(option => option.id === id))) return "A pinned option no longer matches this piece. Remove it before saving.";
  return null;
}