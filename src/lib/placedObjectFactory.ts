import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import type { ProjectInventoryItem } from "@/contexts/ProjectInventoryContext";

/** Hard cap for one composition, shared by every placement entry point. */
export const MAX_PLACED_OBJECTS = 15;

const CUTOUT_TRANSFORMS = "f_png,q_100,w_1200,dpr_auto,c_limit,e_make_transparent:10";

/** Minimal product shape needed to place a piece in the room. */
export type PlaceableProduct = {
  id: string;
  inventoryInstanceId?: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  dimensions: string | null;
  glb_url: string | null;
  productType?: string;
  selectedUpholstery?: string | null;
  selectedFrameFinish?: string | null;
  variantLabel?: string | null;
  finishes?: string[];
  upholsteryMaterial?: PlacedObject["upholsteryMaterial"];
};

/** Transfer the frozen page selection, never re-resolve a similar catalogue piece. */
export function inventoryItemToPlaceable(item: ProjectInventoryItem): PlaceableProduct {
  return {
    inventoryInstanceId: item.instanceId,
    id: item.id, product_name: item.productName, productType: item.productName,
    brand_name: item.brandName, image_url: item.imageUrl,
    dimensions: item.dimensions, glb_url: item.glbUrl,
    selectedUpholstery: item.selectedUpholstery ?? null,
    selectedFrameFinish: item.selectedFrameFinish ?? null,
    variantLabel: item.variantLabel, finishes: [...item.finishes],
    upholsteryMaterial: item.upholsteryMaterial ? { ...item.upholsteryMaterial } : null,
  };
}

/**
 * Single spawn path for every placed piece — catalogue drawer, Project Assets
 * drawer (click or drag-and-drop on the 2D plan) all build their PlacedObject
 * here so the 2D layout and the 3D scene always see the same shape.
 */
export function createPlacedObject(
  product: PlaceableProduct,
  position: [number, number, number],
): PlacedObject {
  return {
    instanceId: `${product.id}-${Date.now()}`,
    inventoryInstanceId: product.inventoryInstanceId,
    id: product.id,
    product_name: product.product_name,
    productType: product.product_name,
    selectedUpholstery: product.selectedUpholstery ?? null,
    selectedFrameFinish: product.selectedFrameFinish ?? null,
    variantLabel: product.variantLabel ?? null,
    finishes: product.finishes ? [...product.finishes] : [],
    brand_name: product.brand_name,
    image_url: product.image_url ? optimizeImageUrl(product.image_url, CUTOUT_TRANSFORMS) : null,
    dimensions: product.dimensions,
    glb_url: product.glb_url,
    position,
    rotation: [0, 0, 0],
    scale: 1,
    material: null,
    baseMaterial: null,
    upholsteryMaterial: product.upholsteryMaterial ? { ...product.upholsteryMaterial } : null,
  };
}

/** Legacy placements lacked provenance; match their complete saved configuration, never just the product. */
export function removeInventoryPlacements(objects: PlacedObject[], item: ProjectInventoryItem): PlacedObject[] {
  return objects.filter(object => {
    if (object.inventoryInstanceId) return object.inventoryInstanceId !== item.instanceId;
    const sameLegacyConfiguration = object.id === item.id
      && object.product_name === item.productName
      && object.dimensions === item.dimensions
      && (object.variantLabel ?? null) === item.variantLabel
      && (object.selectedUpholstery ?? null) === (item.selectedUpholstery ?? null)
      && (object.selectedFrameFinish ?? null) === (item.selectedFrameFinish ?? null)
      && JSON.stringify(object.finishes ?? []) === JSON.stringify(item.finishes);
    return !sameLegacyConfiguration;
  });
}
