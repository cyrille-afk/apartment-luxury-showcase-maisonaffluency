import { useMemo } from "react";
import * as THREE from "three";
import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";

export interface CinematicPath {
  curve: THREE.CatmullRomCurve3;
  /** Centre of the curated furniture cluster; the camera always looks here. */
  target: THREE.Vector3;
  /** Sampled path (metres) for export to video APIs. */
  samples: Array<[number, number, number]>;
  durationSec: number;
}

const EYE = 1.45; // standing eye height, metres

/**
 * Smooth closed-ish camera trajectory through an AI-curated room:
 * establishing corner → sweep past the sofa → orbit the lighting feature → settle front.
 * Waypoints are clamped inside the room so the camera never passes through walls.
 */
export function buildCinematicPath(scene: AICuratedSceneSchema, sampleCount = 120, durationSec = 14): CinematicPath | null {
  const assets = scene.curatedAssets;
  if (!assets.length) return null;
  const { width: W, length: L, height: H } = scene.roomDimensions;
  const clampX = (x: number) => THREE.MathUtils.clamp(x, -W / 2 + 0.4, W / 2 - 0.4);
  const clampZ = (z: number) => THREE.MathUtils.clamp(z, -L / 2 + 0.4, L / 2 - 0.4);
  const clampY = (y: number) => THREE.MathUtils.clamp(y, 0.6, H - 0.3);
  const v = (x: number, y: number, z: number) => new THREE.Vector3(clampX(x), clampY(y), clampZ(z));

  const target = assets
    .reduce((acc, a) => acc.add(new THREE.Vector3(a.position[0], 0, a.position[2])), new THREE.Vector3())
    .divideScalar(assets.length)
    .setY(0.6);

  // Primary anchors by catalogue convention: sofa is placed first, the light sits nearest a back corner.
  const sofa = new THREE.Vector3(...assets[0].position);
  const light = assets
    .map((a) => new THREE.Vector3(...a.position))
    .sort((a, b) => Math.hypot(Math.abs(b.x) - W / 2, b.z + L / 2) - Math.hypot(Math.abs(a.x) - W / 2, a.z + L / 2))
    .pop()!;

  const pts: THREE.Vector3[] = [
    v(W / 2, H * 0.85, L / 2), // establishing high corner
    v(target.x + 1.8, EYE, target.z + 2.2),
    v(sofa.x + 1.6, EYE * 0.85, sofa.z + 1.4), // sweep past the sofa
    v(sofa.x - 1.6, EYE * 0.85, sofa.z + 1.4),
  ];
  // Three-quarter orbit of the lighting feature.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.25 + (i / 3) * Math.PI * 0.9;
    pts.push(v(light.x + Math.cos(a) * 1.3, EYE + 0.2, light.z + Math.sin(a) * 1.3));
  }
  pts.push(v(target.x, EYE + 0.3, L / 2 - 0.5)); // settle on the front view

  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
  const samples = curve.getSpacedPoints(sampleCount - 1).map((p) => [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)] as [number, number, number]);
  return { curve, target, samples, durationSec };
}

export function useCinematicPath(scene: AICuratedSceneSchema | null, durationSec = 14) {
  return useMemo(() => (scene ? buildCinematicPath(scene, 120, durationSec) : null), [scene, durationSec]);
}
