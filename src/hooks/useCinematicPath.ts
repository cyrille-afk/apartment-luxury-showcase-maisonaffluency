import { useMemo } from "react";
import * as THREE from "three";
import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";

export type CinematicPreset = "sweep" | "slow-orbit" | "furniture-tour";
export const CINEMATIC_PRESETS: Array<{ value: CinematicPreset; label: string }> = [
  { value: "sweep", label: "Signature sweep" },
  { value: "slow-orbit", label: "Slow orbit" },
  { value: "furniture-tour", label: "Furniture tour" },
];

export interface CinematicPath {
  curve: THREE.CatmullRomCurve3;
  target: THREE.Vector3;
  samples: Array<[number, number, number]>;
  durationSec: number;
  lookAtCurve?: THREE.CatmullRomCurve3;
  lookAtSamples?: Array<[number, number, number]>;
}

/** Elevated open arc: conservative bounds match SceneObject's 1.4m GLB fit. */
export function buildCinematicPath(scene: AICuratedSceneSchema, sampleCount = 120, durationSec = 24, preset: CinematicPreset = "sweep"): CinematicPath | null {
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
  let pts = [
    v(W * 0.38, H * 0.78, L * 0.38),
    v(target.x + W * 0.3, eye + 0.1, target.z + L * 0.2),
    v(sofa.x + W * 0.18, eye, sofa.z + L * 0.32),
    v(sofa.x - W * 0.12, eye, sofa.z + L * 0.32),
    v(light.x + W * 0.23, eye + 0.1, light.z + L * 0.28),
    v(target.x - W * 0.28, eye + 0.15, target.z + L * 0.25),
    v(target.x - W * 0.12, eye + 0.25, L * 0.38),
    v(target.x, eye + 0.25, L * 0.38),
  ];
  let lookAtCurve: THREE.CatmullRomCurve3 | undefined;
  if (preset === "slow-orbit") {
    const cx = THREE.MathUtils.clamp(target.x, -W / 2 + 0.8, W / 2 - 0.8);
    const cz = THREE.MathUtils.clamp(target.z, -L / 2 + 0.8, L / 2 - 0.8);
    const rx = Math.min(W * 0.35, W / 2 - 0.65 - Math.abs(cx));
    const rz = Math.min(L * 0.35, L / 2 - 0.65 - Math.abs(cz));
    pts = Array.from({ length: 13 }, (_, i) => {
      const angle = Math.PI / 4 + i / 12 * Math.PI * 2;
      return v(cx + rx * Math.cos(angle), eye + 0.1, cz + rz * Math.sin(angle));
    });
    durationSec = Math.max(40, durationSec);
  } else if (preset === "furniture-tour") {
    // Visit the sofa first, then nearest neighbours to avoid criss-crossing.
    const remaining = assets.filter((a) => a !== sofaAsset);
    const ordered = [sofaAsset];
    while (remaining.length) {
      const last = ordered[ordered.length - 1];
      if (!last) break;
      remaining.sort((a, b) => Math.hypot(a.position[0] - last.position[0], a.position[2] - last.position[2])
        - Math.hypot(b.position[0] - last.position[0], b.position[2] - last.position[2]));
      const next = remaining.shift();
      if (next) ordered.push(next);
    }
    const focuses: THREE.Vector3[] = [];
    pts = ordered.flatMap((a) => {
      const focus = new THREE.Vector3(a.position[0], a.position[1] + 0.6, a.position[2]);
      focuses.push(focus.clone(), focus.clone());
      return [v(a.position[0] + 0.85, eye + 0.1, a.position[2] + 1.2),
        v(a.position[0] - 0.65, eye + 0.1, a.position[2] + 1.2)];
    });
    lookAtCurve = new THREE.CatmullRomCurve3(focuses, false, "centripetal", 0.5);
    durationSec = Math.max(32, ordered.length * 7, durationSec);
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
  // Validate interpolated points too: a spline can overshoot its control points.
  if (curve.getPoints(1000).some((p) => p.y < top + 0.34 || p.y > H - 0.2
    || Math.abs(p.x) > W / 2 - 0.25 || Math.abs(p.z) > L / 2 - 0.25)) return null;
  const samples = curve.getSpacedPoints(Math.max(2, sampleCount) - 1)
    .map((p) => [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)] as [number, number, number]);
  const lookAtSamples = lookAtCurve ? samples.map((_, i) => lookAtCurve.getPoint(curve.getUtoTmapping(i / (samples.length - 1), 0)).toArray() as [number, number, number]) : undefined;
  return { curve, target: lookAtCurve?.getPoint(0) ?? target, samples, lookAtCurve, lookAtSamples,
    durationSec: Math.max(durationSec, curve.getLength() / (preset === "slow-orbit" ? 0.3 : 0.55)) };
}

export function useCinematicPath(scene: AICuratedSceneSchema | null, durationSec = 24, preset: CinematicPreset = "sweep") {
  return useMemo(() => scene ? buildCinematicPath(scene, 120, durationSec, preset) : null, [scene, durationSec, preset]);
}
