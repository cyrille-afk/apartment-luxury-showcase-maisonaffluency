import { useMemo } from "react";
import * as THREE from "three";
import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";

export interface CinematicPath {
  curve: THREE.CatmullRomCurve3;
  target: THREE.Vector3;
  samples: Array<[number, number, number]>;
  durationSec: number;
}

/** Elevated open arc: conservative bounds match SceneObject's 1.4m GLB fit. */
export function buildCinematicPath(scene: AICuratedSceneSchema, sampleCount = 120, durationSec = 24): CinematicPath | null {
  const assets = scene.curatedAssets;
  if (!assets.length) return null;
  const { width: W, length: L, height: H } = scene.roomDimensions;
  if (![W, L, H].every((n) => Number.isFinite(n) && n > 1.5)) return null;
  const top = Math.max(...assets.map((a) => {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...a.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...a.rotation)), new THREE.Vector3(...a.scale));
    return new THREE.Box3(new THREE.Vector3(-0.7, 0, -0.7), new THREE.Vector3(0.7, 1.4, 0.7)).applyMatrix4(matrix).max.y;
  }));
  const eye = Math.max(1.8, top + 0.35);
  if (eye > H - 0.35) return null;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(
    THREE.MathUtils.clamp(x, -W / 2 + 0.65, W / 2 - 0.65),
    THREE.MathUtils.clamp(y, eye, H - 0.35),
    THREE.MathUtils.clamp(z, -L / 2 + 0.65, L / 2 - 0.65));
  const target = assets.reduce((acc, a) => acc.add(new THREE.Vector3(a.position[0], 0, a.position[2])), new THREE.Vector3())
    .divideScalar(assets.length).setY(0.6);
  const sofaAsset = assets.find((a) => /sofa|sandy.?cove/i.test(a.sku)) ?? assets[0];
  if (!sofaAsset) return null;
  const sofa = new THREE.Vector3(...sofaAsset.position);
  const lightAsset = assets.find((a) => /lamp|light|cinnamon/i.test(a.sku));
  const light = lightAsset ? new THREE.Vector3(...lightAsset.position) : target;
  const pts = [
    v(W * 0.38, H * 0.78, L * 0.38),
    v(target.x + W * 0.3, eye + 0.1, target.z + L * 0.2),
    v(sofa.x + W * 0.18, eye, sofa.z + L * 0.32),
    v(sofa.x - W * 0.12, eye, sofa.z + L * 0.32),
    v(light.x + W * 0.23, eye + 0.1, light.z + L * 0.28),
    v(target.x - W * 0.28, eye + 0.15, target.z + L * 0.25),
    v(target.x - W * 0.12, eye + 0.25, L * 0.38),
    v(target.x, eye + 0.25, L * 0.38),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
  // Validate interpolated points too: a spline can overshoot its control points.
  if (curve.getPoints(1000).some((p) => p.y < top + 0.34 || p.y > H - 0.2
    || Math.abs(p.x) > W / 2 - 0.25 || Math.abs(p.z) > L / 2 - 0.25)) return null;
  const samples = curve.getSpacedPoints(Math.max(2, sampleCount) - 1)
    .map((p) => [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)] as [number, number, number]);
  return { curve, target, samples, durationSec: Math.max(durationSec, curve.getLength() / 0.55) };
}

export function useCinematicPath(scene: AICuratedSceneSchema | null, durationSec = 24) {
  return useMemo(() => scene ? buildCinematicPath(scene, 120, durationSec) : null, [scene, durationSec]);
}
