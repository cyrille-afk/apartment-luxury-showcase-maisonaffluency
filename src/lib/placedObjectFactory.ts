import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";

/** Hard cap for one composition, shared by every placement entry point. */
export const MAX_PLACED_OBJECTS = 15;

const CUTOUT_TRANSFORMS = "f_png,q_100,w_1200,dpr_auto,c_limit,e_make_transparent:10";

/** Minimal product shape needed to place a piece in the room. */
export type PlaceableProduct = {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  dimensions: string | null;
  glb_url: string | null;
};

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
    id: product.id,
    product_name: product.product_name,
    brand_name: product.brand_name,
    image_url: product.image_url ? optimizeImageUrl(product.image_url, CUTOUT_TRANSFORMS) : null,
    dimensions: product.dimensions,
    glb_url: product.glb_url,
    position,
    rotation: [0, 0, 0],
    scale: 1,
    material: null,
    baseMaterial: null,
    upholsteryMaterial: null,
  };
}
