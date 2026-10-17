import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";

/** Export only the client selection, never renderer caches or financial fields. */
export function visualiserClientSelection(objects: PlacedObject[]) {
  return objects.map((object) => {
    const fabric = object.upholsteryMaterial?.name ?? object.topMaterial?.name ?? null;
    const wood = object.baseMaterial?.name ?? null;
    const other = [object.material?.name, ...Object.values(object.partMaterials ?? {}).map((m) => m?.name)]
      .filter((name): name is string => Boolean(name) && name !== fabric && name !== wood);
    return {
      product_id: object.id,
      fabric_label: fabric,
      wood_label: wood,
      variant_label: [...new Set(other)].join(" / ") || null,
    };
  });
}