import { z } from "zod";
import type { ScenePresetData } from "./visualiserScenePresets";

const safeUrl = z.string().max(7000000).refine((s) => /^https:\/\//i.test(s) || /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(s), "Use a hosted image or uploaded room photograph");
const vector = z.tuple([z.number().finite().min(-1000).max(1000), z.number().finite().min(-1000).max(1000), z.number().finite().min(-1000).max(1000)]);
const material = z.object({
  id: z.string(), name: z.string(), brand_name: z.string(), category: z.string(), material_type: z.string().nullable(), color_family: z.string().nullable(),
  image_url: safeUrl.nullable(), diffuse_url: safeUrl.nullable().optional(), normal_url: safeUrl.nullable().optional(), roughness_url: safeUrl.nullable().optional(),
  target: z.string().optional(), color: z.string().optional(), repeat: z.number().finite().min(0.01).max(100).optional(), roughness: z.number().min(0).max(1).optional(), metalness: z.number().min(0).max(1).optional(),
});
const object = z.object({
  id: z.string().guid(), instanceId: z.string().min(1), boardItemId: z.string().guid().optional(), product_name: z.string(), brand_name: z.string(),
  image_url: safeUrl.nullable(), dimensions: z.string().nullable(), glb_url: safeUrl.nullable(), position: vector, rotation: vector, scale: z.number().min(0.01).max(100),
  width_mm: z.number().nullable().optional(), depth_mm: z.number().nullable().optional(), height_mm: z.number().nullable().optional(), modelOrientation: z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]).optional(),
  material: material.nullable().optional(), topMaterial: material.nullable().optional(), baseMaterial: material.nullable().optional(), upholsteryMaterial: material.nullable().optional(),
  partMaterials: z.record(z.string(), z.union([material, z.object({}).strict().transform(() => null)]).nullable()).optional(), marbleSurface: z.object({ reflectivity: z.number().min(0).max(1).optional(), roughness: z.number().min(0).max(1).optional() }).optional(),
});
const roomFields = ["floorFinish", "showRearWall", "wallHeight", "ceilingHeight", "ceilingThickness", "ceilingOpening", "floorGlare", "wallColor", "wallFinish", "wallCustomHex", "wallFinishIntensity", "featureWallFinish", "rugColor", "rugBorderColor", "rugBorderThicknessMm", "rugBorderTwistMm", "rugBorderRoughness", "rugWeave", "rugPile", "rugWidth", "rugDepth", "rugOffsetX", "rugOffsetZ", "rugRotation", "showRug", "backdropColor", "backdropBrightness", "depthOfField", "dofStrength", "dofFocusSelected", "environmentSource"] as const;
export type SharedVisualiserRoom = Omit<ScenePresetData, "objects"> & { version: 1; objects: (ScenePresetData["objects"][number] & { boardItemId?: string })[] };

/** Explicit allowlist prevents nested trade data from becoming a client snapshot. */
export function sharedVisualiserRoom(input: unknown): SharedVisualiserRoom {
  const source = z.object({ version: z.literal(1).optional(), objects: z.array(object).min(1).max(15).refine(objects => new Set(objects.map(o => o.instanceId)).size === objects.length, "Every room instance must be unique"), backdropDataUrl: safeUrl.nullable().optional(), advancedRendering: z.object({ shadowSharpness: z.number().min(0).max(100).optional(), contrastIntensity: z.number().min(0).max(100).optional(), contactShadowIntensity: z.number().min(0).max(100).optional() }).optional() }).passthrough().parse(input);
  const result: Record<string, unknown> = { version: 1, objects: source.objects, backdropDataUrl: source.backdropDataUrl ?? null, advancedRendering: source.advancedRendering };
  for (const key of roomFields) {
    const value = source[key];
    if (value === null || typeof value === "boolean" || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) result[key] = value;
  }
  return result as SharedVisualiserRoom;
}