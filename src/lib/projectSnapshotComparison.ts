import type { PlacedObject } from '@/components/trade/visualiser/SceneObject';
import type { ProjectSnapshotData } from './projectLayoutSnapshots';
import { humanizePartName } from './visualiserFinishTargets';

export function snapshotFinishes(object: PlacedObject) {
  return [
    ['Finish', object.material], ['Table Top', object.topMaterial],
    ['Base Structure', object.baseMaterial], ['Upholstery', object.upholsteryMaterial],
    ...Object.entries(object.partMaterials ?? {}).map(([part, material]) => [humanizePartName(part), material]),
  ].flatMap(([label, material]) => typeof material === 'object' && material?.name
    ? [{ label: String(label), name: material.name, image: material.image_url ?? null, id: material.id }] : []);
}

export function snapshotChanges(left: ProjectSnapshotData, right: ProjectSnapshotData) {
  const a = new Map(left.scene.objects.map(o => [o.instanceId, o]));
  const b = new Map(right.scene.objects.map(o => [o.instanceId, o]));
  return Array.from(new Set([...a.keys(), ...b.keys()])).map(id => {
    const before = a.get(id), after = b.get(id);
    const layoutChanged = !!before && !!after && JSON.stringify([before.position, before.rotation, before.scale, before.modelOrientation]) !== JSON.stringify([after.position, after.rotation, after.scale, after.modelOrientation]);
    const finishesChanged = !!before && !!after && JSON.stringify([before.material, before.topMaterial, before.baseMaterial, before.upholsteryMaterial, before.partMaterials, before.marbleSurface]) !== JSON.stringify([after.material, after.topMaterial, after.baseMaterial, after.upholsteryMaterial, after.partMaterials, after.marbleSurface]);
    return { id, before, after, layoutChanged, finishesChanged, status: !before ? 'Added' : !after ? 'Removed' : layoutChanged || finishesChanged ? 'Changed' : 'Unchanged' };
  });
}

export function snapshotFootprint(object: PlacedObject) {
  const scale = Number.isFinite(object.scale) && object.scale > 0 ? object.scale : 1;
  return { width: (object.width_mm && object.width_mm > 0 ? object.width_mm / 1000 : 0.7) * scale, depth: (object.depth_mm && object.depth_mm > 0 ? object.depth_mm / 1000 : 0.6) * scale };
}