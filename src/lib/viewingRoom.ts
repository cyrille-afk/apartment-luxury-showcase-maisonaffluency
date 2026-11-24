import { z } from "zod";
import { layoutSpatialItems, spatialLayoutBounds } from "./spatialLayoutEngine";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";

const url = z.string().refine(value => value.startsWith("https://") || value.startsWith("/__l5e/"), "Invalid media URL").nullable();
const material = z.object({ id: z.string(), name: z.string(), category: z.string(), brand_name: z.string(), image_url: url, material_type: z.string().nullable(), color_family: z.string().nullable() });
export const viewingRoomItemSchema = z.object({ id: z.string().uuid(), product_name: z.string(), category: z.string().nullable(), subcategory: z.string().nullable(), image_url: url, dimensions: z.string().nullable(), width_mm: z.number().nullable(), depth_mm: z.number().nullable(), height_mm: z.number().nullable(), glb_url: url, material_roles: z.record(z.string(), z.enum(["fabric", "base", "top", "ignore"])).optional(), lead_time: z.string().nullable(), materials: z.record(z.string(), material) });
export const viewingRoomPackageSchema = z.object({ id: z.string().uuid(), tier_name: z.string(), package_price: z.number().nonnegative(), currency: z.enum(["EUR", "USD", "SGD", "GBP", "CHF"]), description: z.string(), lead_time_weeks: z.number().nullable() });
export const viewingRoomSchema = z.object({ name: z.string(), logo: url, hero: url, project_name: z.string(), layouts: z.array(z.object({ id: z.string().uuid(), name: z.string(), floorplan_url: url, specs_label: z.string().nullable(), room_environment_glb: url, packages: z.array(viewingRoomPackageSchema) })) });
export type ViewingRoom = z.infer<typeof viewingRoomSchema>;
export type ViewingRoomItem = z.infer<typeof viewingRoomItemSchema>;
export const viewingRoomFinishSchema = z.object({ key: z.string(), label: z.string(), retail_price: z.number().nonnegative(), materials: z.record(z.string(), material), image_url: url, lead_time: z.string().nullable(), size_key: z.string().optional(), dimensions: z.string().optional(), colourways: z.array(material).default([]) });
export const viewingRoomChoiceSchema = viewingRoomItemSchema.extend({ retail_price: z.number().nullable(), retail_price_from: z.boolean().default(false), finish_options: z.array(viewingRoomFinishSchema).default([]), finish_key: z.string().optional(), size_key: z.string().optional(), colourway_id: z.string().optional(), size_options: z.array(z.object({ key: z.string(), label: z.string() })).default([]) });
export const viewingRoomSlotSchema = viewingRoomChoiceSchema.extend({ alternatives: z.array(viewingRoomChoiceSchema), is_swappable: z.boolean().default(true), allow_finish_customization: z.boolean().default(true) });
export type ViewingRoomChoice = z.infer<typeof viewingRoomChoiceSchema>;
export type ViewingRoomSlot = z.infer<typeof viewingRoomSlotSchema>;
export function viewingRoomTotal(base: number, slots: ViewingRoomSlot[], choices: Record<string, ViewingRoomChoice>): number {
  return slots.reduce((sum, slot) => {
    const choice = choices[slot.id];
    if (!choice) return sum;
    const approved = choice.id === slot.id ? slot : slot.is_swappable ? slot.alternatives.find(row => row.id === choice.id) : null;
    if (!approved || approved.retail_price == null || slot.retail_price == null) throw new Error("Unapproved or unpriced choice");
    const selected = viewingRoomSelection(slot, choice.id, choice.finish_key, choice.size_key, choice.colourway_id);
    return sum + Number(selected.retail_price) - slot.retail_price;
  }, base);
}

export function viewingRoomSelection(slot: ViewingRoomSlot, productId: string, finishKey?: string, sizeKey?: string, colourwayId?: string): ViewingRoomChoice {
  const product = productId === slot.id ? slot : slot.is_swappable ? slot.alternatives.find(row => row.id === productId) : null;
  if (!product) throw new Error("Unapproved choice");
  const finish = finishKey && slot.allow_finish_customization ? product.finish_options.find(row => row.key === finishKey) : null;
  if (finishKey && !finish) throw new Error("Unapproved finish");
  if ((finish && finish.size_key !== sizeKey) || (sizeKey && !finish)) throw new Error("Unapproved size");
  if (!finish) { if (colourwayId) throw new Error("Unapproved colourway"); return product; }
  const colourway = colourwayId ? finish.colourways.find(row => row.id === colourwayId) : undefined;
  if (colourwayId && !colourway) throw new Error("Unapproved colourway");
  const { colourways: _colourways, ...rest } = finish;
  const selected: ViewingRoomChoice = { ...product, ...rest, id: product.id, finish_key: finish.key, retail_price_from: false, materials: colourway ? { ...finish.materials, upholstery: colourway } : finish.materials };
  if (colourway) selected.colourway_id = colourway.id; else delete selected.colourway_id;
  return selected;
}

export function viewingRoomSizeSelection(slot: ViewingRoomSlot, draft: ViewingRoomChoice, sizeKey: string): ViewingRoomChoice {
  const product = draft.id === slot.id ? slot : slot.alternatives.find(row => row.id === draft.id);
  if (!product?.size_options?.some(size => size.key === sizeKey)) throw new Error("Unapproved size");
  const previous = product.finish_options.find(finish => finish.key === draft.finish_key);
  const available = product.finish_options.filter(finish => finish.size_key === sizeKey);
  const finish = available.find(option => option.label === previous?.label) ?? available[0];
  if (!finish) throw new Error("Unapproved size");
  const colourway = draft.colourway_id && finish.colourways.some(row => row.id === draft.colourway_id) ? draft.colourway_id : undefined;
  return viewingRoomSelection(slot, draft.id, finish.key, sizeKey, colourway);
}

/** Only named visual materials and measured placement enter the client renderer. */
export function viewingRoomComposition(items: ViewingRoomItem[]) {
  const placements = layoutSpatialItems(items);
  const bounds = spatialLayoutBounds(placements);
  const objects: PlacedObject[] = placements.map(({ item, x, z, rotationY, isAnchor }) => ({
    id: item.id, instanceId: item.id, product_name: item.product_name, brand_name: "", image_url: item.image_url, dimensions: item.dimensions,
    width_mm: item.width_mm, depth_mm: item.depth_mm, height_mm: item.height_mm, glb_url: item.glb_url, position: [x, 0, z], rotation: [0, rotationY, 0], scale: 1, isAnchor,
    baseMaterial: item.materials.base, topMaterial: item.materials.top, upholsteryMaterial: item.materials.upholstery,
    partMaterials: { frame: item.materials.base ?? null },
  }));
  return { objects, width: Math.max(7.2, bounds.width + 2), depth: Math.max(6, bounds.depth + 2) };
}

export type ViewingRoomCameraPreset = "living" | "terrace" | "overview";
export function viewingRoomCamera(view: ViewingRoomCameraPreset, width: number, depth: number, aspect = 1.8): { position: [number, number, number]; target: [number, number, number] } {
  // Retreat outside the open front; fit horizontal bounds and the nearest floor edge.
  const tangent = Math.tan(48 * Math.PI / 360);
  const retreat = depth / 2 + Math.max(1.65 / tangent, width / (2 * tangent * Math.max(.35, aspect)));
  const x = view === "living" ? width * .12 : view === "terrace" ? -width * .18 : 0;
  return { position: [x, 1.35, retreat * (view === "overview" ? 1.12 : 1)], target: [0, 1.35, 0] };
}

export function viewingRoomLeadTime(weeks: number | null, items?: ViewingRoomItem[]): string {
  if (weeks != null && weeks > 0) return `${weeks} weeks`;
  const times = items?.map(item => item.lead_time?.match(/\d+/g)?.map(Number) ?? []);
  if (!times?.length || times.some(time => !time.length)) return "To be confirmed";
  return `${Math.max(...times.flat())} weeks`;
}
/** Finishes the 3D viewer should paint. An unconfigured piece borrows the materials of the finish option priced as presented, so it never opens bare. */
export function viewingRoomViewerMaterials(choice: ViewingRoomChoice): ViewingRoomChoice["materials"] {
  if (choice.finish_key || choice.materials.upholstery || choice.materials.base || choice.materials.top) return choice.materials;
  const match = choice.finish_options.find(option => option.size_key === choice.size_key && option.retail_price === choice.retail_price && Object.keys(option.materials).length > 0);
  return match ? { ...match.materials, ...(match.colourways[0] && !match.materials["upholstery"] ? { upholstery: match.colourways[0] } : {}) } : choice.materials;
}
