import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import { withPartMaterial, type FinishTarget } from "./visualiserFinishTargets";

export function finishComparisonObjects(objects: PlacedObject[], instanceId: string, target: FinishTarget, material: VisualiserMaterial | null): PlacedObject[] {
  return objects.map(object => object.instanceId === instanceId && material
    ? withPartMaterial(object, target, material)
    : object);
}

export function applyComparedFinish(objects: PlacedObject[], instanceId: string, target: FinishTarget, material: VisualiserMaterial): PlacedObject[] {
  return objects.map(object => object.instanceId === instanceId && !object.finishesLocked
    ? withPartMaterial(object, target, material)
    : object);
}