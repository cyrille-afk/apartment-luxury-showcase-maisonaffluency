import { z } from "zod";
import { absoluteUrl } from "@/config/site";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import type { PieceAppearance } from "@/types/aiCuratedScene";
import type { RoomBounds } from "./activeProjectLayout";
import type { SharedRoomLayout } from "./sharedRoomLayout";
import { layoutSpatialItems, spatialLayoutBounds } from "./spatialLayoutEngine";
import { viewingRoomChoiceSchema, viewingRoomViewerMaterials, type ViewingRoomChoice } from "./viewingRoom";
import { toVisualiserRoles } from "./visualiserSavedMaterialRoles";

const mediaUrlSchema = z.string().refine(
  (value) => value.startsWith("https://") || value.startsWith("http://") || value.startsWith("/__l5e/"),
  "Invalid media URL",
).nullable();

export type LinkedProposalState = {
  proposalId: string;
  projectId: string;
  developerName: string;
  residenceName: string;
  tierName: string;
  shareToken: string;
  floorPlanUrl: string | null;
  axonometricRenderUrl: string | null;
  walkthroughUrl: string | null;
  walkthroughLayoutId: string | null;
  visualiserPublishedAt: string | null;
};

export type VisualiserProposalItem = ViewingRoomChoice & {
  slot_id: string;
  product_id: string;
};

export type VisualiserProposalPayload = {
  proposalId: string;
  projectId: string;
  developerName: string;
  tierName: string;
  currency: string;
  total: number;
  lockedAt: string;
  shareToken: string;
  axonometricRenderUrl: string | null;
  walkthroughUrl: string | null;
  walkthroughLayoutId: string | null;
  visualiserPublishedAt: string | null;
  layout: {
    id: string;
    name: string;
    floorplan_url: string | null;
    specs_label: string | null;
  };
  items: VisualiserProposalItem[];
};

export const sharedViewingRoomProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  locked_at: z.string(),
  share_token: z.string().min(16),
  developer: z.object({ name: z.string(), logo: mediaUrlSchema, hero: mediaUrlSchema }),
  residence: z.object({ name: z.string(), floorplan_url: mediaUrlSchema, specs_label: z.string().nullable() }),
  package: z.object({ tier_name: z.string(), currency: z.string(), lead_time_weeks: z.number().nullable() }),
  snapshot: z.object({
    package: z.string(),
    currency: z.string(),
    total: z.number(),
    items: z.array(viewingRoomChoiceSchema),
  }),
  axonometric_render_url: mediaUrlSchema,
  walkthrough_url: z.string().url().nullable(),
  visualiser_published_at: z.string().nullable(),
});

export type SharedViewingRoomProposal = z.infer<typeof sharedViewingRoomProposalSchema>;

export function visualiserProposalPath(proposalId: string): string {
  return `/trade/visualiser?proposalId=${encodeURIComponent(proposalId)}`;
}

export function sharedProposalPath(shareToken: string): string {
  return `/viewing-room/proposal/${encodeURIComponent(shareToken)}`;
}

export function sharedProposalUrl(shareToken: string): string {
  return absoluteUrl(sharedProposalPath(shareToken));
}

function toVisualiserMaterial(
  swatch: ViewingRoomChoice["materials"][string] | undefined,
): VisualiserMaterial | null {
  if (!swatch) return null;
  return {
    id: swatch.id,
    name: swatch.name,
    category: swatch.category,
    brand_name: swatch.brand_name,
    image_url: swatch.image_url,
    material_type: swatch.material_type,
    color_family: swatch.color_family,
  };
}

export function buildVisualiserProposalStaging(payload: VisualiserProposalPayload): {
  floorPlanUrl: string | null;
  bounds: RoomBounds;
  objects: PlacedObject[];
  sharedRoomLayout: SharedRoomLayout;
  linkedProposal: LinkedProposalState;
} {
  const placements = layoutSpatialItems(payload.items);
  const footprint = spatialLayoutBounds(placements);
  const bounds: RoomBounds = {
    width: Math.max(7.2, Math.round((footprint.width + 2) * 10) / 10),
    depth: Math.max(6, Math.round((footprint.depth + 2) * 10) / 10),
    height: 3.0,
  };

  const objects: PlacedObject[] = placements.map(({ item, x, z, rotationY, isAnchor }) => {
    const materials = viewingRoomViewerMaterials(item);
    const upholstery = toVisualiserMaterial(materials["upholstery"]);
    const backrest = toVisualiserMaterial(materials["backrest"]);
    const base = toVisualiserMaterial(materials["base"]);
    const top = toVisualiserMaterial(materials["top"]);
    const partMaterials: Record<string, VisualiserMaterial | null> = {};
    if (base) partMaterials["frame"] = base;
    if (backrest) partMaterials["backrest"] = backrest;
    const finishes = [upholstery?.name, backrest?.name, top?.name, base?.name].filter((v): v is string => Boolean(v));

    return {
      id: item.product_id,
      instanceId: `proposal-${payload.proposalId.slice(0, 8)}-${item.slot_id}`,
      product_name: item.product_name,
      brand_name: item.brand_name ?? "",
      category: item.category,
      subcategory: item.subcategory,
      image_url: item.image_url,
      dimensions: item.dimensions,
      width_mm: item.width_mm,
      depth_mm: item.depth_mm,
      height_mm: item.height_mm,
      glb_url: item.glb_url,
      position: [x, 0, z],
      rotation: [0, rotationY, 0],
      scale: 1,
      isAnchor,
      ...(item.material_roles ? { savedMaterialRoles: toVisualiserRoles(item.material_roles) } : {}),
      ...(upholstery ? { upholsteryMaterial: upholstery, selectedUpholstery: upholstery.name } : {}),
      ...(base ? { baseMaterial: base, selectedFrameFinish: base.name } : {}),
      ...(top ? { topMaterial: top } : {}),
      ...(Object.keys(partMaterials).length ? { partMaterials } : {}),
      ...(finishes.length ? { finishes } : {}),
    };
  });

  const sharedRoomLayout: SharedRoomLayout = {
    projectId: payload.projectId,
    room: { width: bounds.width, length: bounds.depth, height: bounds.height },
    source: "visualiser",
    updatedAt: Date.now(),
    items: objects.map((obj, index) => {
      const source = placements[index]?.item;
      const appearance: PieceAppearance = {
        scale: obj.scale,
        ...(obj.baseMaterial ? { baseMaterial: obj.baseMaterial } : {}),
        ...(obj.topMaterial ? { topMaterial: obj.topMaterial } : {}),
        ...(obj.upholsteryMaterial ? { upholsteryMaterial: obj.upholsteryMaterial } : {}),
        ...(obj.partMaterials ? { partMaterials: obj.partMaterials } : {}),
        ...(obj.selectedUpholstery ? { selectedUpholstery: obj.selectedUpholstery } : {}),
        ...(obj.selectedFrameFinish ? { selectedFrameFinish: obj.selectedFrameFinish } : {}),
        ...(obj.finishes ? { finishes: obj.finishes } : {}),
      };
      return {
        productId: obj.id,
        name: obj.product_name,
        glbUrl: obj.glb_url,
        imageUrl: obj.image_url,
        brandName: obj.brand_name,
        dimensions: obj.dimensions,
        width_mm: obj.width_mm ?? null,
        depth_mm: obj.depth_mm ?? null,
        height_mm: obj.height_mm ?? null,
        category: obj.category ?? null,
        subcategory: obj.subcategory ?? null,
        x: obj.position[0],
        z: obj.position[2],
        rotationY: obj.rotation[1],
        priceEur: source?.retail_price ?? null,
        ...(Object.keys(appearance).length ? { appearance } : {}),
      };
    }),
  };

  return {
    floorPlanUrl: payload.layout.floorplan_url,
    bounds,
    objects,
    sharedRoomLayout,
    linkedProposal: {
      proposalId: payload.proposalId,
      projectId: payload.projectId,
      developerName: payload.developerName,
      residenceName: payload.layout.name,
      tierName: payload.tierName,
      shareToken: payload.shareToken,
      floorPlanUrl: payload.layout.floorplan_url,
      axonometricRenderUrl: payload.axonometricRenderUrl,
      walkthroughUrl: payload.walkthroughUrl,
      walkthroughLayoutId: payload.walkthroughLayoutId,
      visualiserPublishedAt: payload.visualiserPublishedAt,
    },
  };
}