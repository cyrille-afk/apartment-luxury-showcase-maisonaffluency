import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { studioAppearance } from "@/lib/studioFinishes";
import { createPlacedObject, type PlaceableProduct } from "@/lib/placedObjectFactory";

export const SWAP_UNDO_DURATION_MS = 8000;

/** Detached snapshot: later material edits cannot mutate the saved original. */
export function snapshotVisualiserPiece(piece: PlacedObject): PlacedObject {
  return structuredClone(piece);
}

export function restoreVisualiserSwap(objects: PlacedObject[], snapshot: PlacedObject, restoreKey: number): PlacedObject[] {
  return objects.map(object => object.instanceId === snapshot.instanceId
    ? { ...snapshotVisualiserPiece(snapshot), restoreKey }
    : object);
}

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
