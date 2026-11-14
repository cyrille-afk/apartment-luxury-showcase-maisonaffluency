import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { studioAppearance } from "@/lib/studioFinishes";
import { createPlacedObject, type PlaceableProduct } from "@/lib/placedObjectFactory";

/** Preserve the exact composition pose and provenance, but never the old product's materials or import tilt. */
export function buildVisualiserSwap(
  current: PlacedObject,
  alternative: PlaceableProduct,
  appearance: ReturnType<typeof studioAppearance>,
  restoreKey: number,
): PlacedObject {
  const replacement = {
    ...createPlacedObject(
      { ...alternative, specItemId: current.specItemId },
      [current.position[0], 0, current.position[2]],
    ),
    ...appearance,
  } as PlacedObject;
  return {
    ...replacement,
    instanceId: current.instanceId,
    rotation: [...current.rotation],
    scale: current.scale,
    positionLocked: current.positionLocked,
    restoreKey,
    // Project Assets points at the old configured product; Specsheet provenance is handled separately.
    inventoryInstanceId: undefined,
  };
}
