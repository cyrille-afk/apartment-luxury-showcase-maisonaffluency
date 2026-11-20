import { z } from "zod";
import { layoutSpatialItems, spatialLayoutBounds } from "./spatialLayoutEngine";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";

const url = z.string().refine(value => value.startsWith("https://") || value.startsWith("/__l5e/"), "Invalid media URL").nullable();
const material = z.object({ id: z.string(), name: z.string(), category: z.string(), brand_name: z.string(), image_url: url, material_type: z.string().nullable(), color_family: z.string().nullable() });
export const viewingRoomItemSchema = z.object({ id: z.string().uuid(), product_name: z.string(), category: z.string().nullable(), subcategory: z.string().nullable(), image_url: url, dimensions: z.string().nullable(), width_mm: z.number().nullable(), depth_mm: z.number().nullable(), height_mm: z.number().nullable(), glb_url: url, lead_time: z.string().nullable(), materials: z.record(z.string(), material) });
export const viewingRoomPackageSchema = z.object({ id: z.string().uuid(), tier_name: z.string(), package_price: z.number().nonnegative(), currency: z.enum(["EUR", "USD", "SGD", "GBP", "CHF"]), description: z.string(), lead_time_weeks: z.number().nullable() });
export const viewingRoomSchema = z.object({ name: z.string(), logo: url, hero: url, project_name: z.string(), layouts: z.array(z.object({ id: z.string().uuid(), name: z.string(), floorplan_url: url, specs_label: z.string().nullable(), room_environment_glb: url, packages: z.array(viewingRoomPackageSchema) })) });
export type ViewingRoom = z.infer<typeof viewingRoomSchema>;
export type ViewingRoomItem = z.infer<typeof viewingRoomItemSchema>;
export const viewingRoomFinishSchema = z.object({ key: z.string(), label: z.string(), retail_price: z.number().nonnegative(), materials: z.record(z.string(), material), image_url: url, lead_time: z.string().nullable() });
export const viewingRoomChoiceSchema = viewingRoomItemSchema.extend({ retail_price: z.number().nullable(), retail_price_from: z.boolean().default(false), finish_options: z.array(viewingRoomFinishSchema).default([]), finish_key: z.string().optional() });
export const viewingRoomSlotSchema = viewingRoomChoiceSchema.extend({ alternatives: z.array(viewingRoomChoiceSchema), is_swappable: z.boolean().default(true), allow_finish_customization: z.boolean().default(true) });
export type ViewingRoomChoice = z.infer<typeof viewingRoomChoiceSchema>;
export type ViewingRoomSlot = z.infer<typeof viewingRoomSlotSchema>;
export function viewingRoomTotal(base: number, slots: ViewingRoomSlot[], choices: Record<string, ViewingRoomChoice>): number {
  return slots.reduce((sum, slot) => {
    const choice = choices[slot.id];
    if (!choice) return sum;
    const approved = choice.id === slot.id ? slot : slot.is_swappable ? slot.alternatives.find(row => row.id === choice.id) : null;
    if (!approved || approved.retail_price == null || slot.retail_price == null) throw new Error("Unapproved or unpriced choice");
    const finish = choice.finish_key ? approved.finish_options.find(row => row.key === choice.finish_key) : null;
    if (choice.finish_key && (!slot.allow_finish_customization || !finish)) throw new Error("Unapproved finish");
    return sum + (finish?.retail_price ?? approved.retail_price) - slot.retail_price;
  }, base);
}

export function viewingRoomSelection(slot: ViewingRoomSlot, productId: string, finishKey?: string): ViewingRoomChoice {
  const product = productId === slot.id ? slot : slot.is_swappable ? slot.alternatives.find(row => row.id === productId) : null;
  if (!product) throw new Error("Unapproved choice");
  const finish = finishKey && slot.allow_finish_customization ? product.finish_options.find(row => row.key === finishKey) : null;
  if (finishKey && !finish) throw new Error("Unapproved finish");
  return finish ? { ...product, ...finish, id: product.id, finish_key: finish.key, retail_price_from: false } : product;
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