import { describe, expect, it } from "vitest";
import { buildCinematicPath } from "./useCinematicPath";
import { cinematicProgress } from "@/components/trade/visualiser/CinematicCameraRig";
import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";
import { buildSceneVideoPayload } from "@/lib/sceneVideoExport";
const scene: AICuratedSceneSchema = {
  roomDimensions: { width: 7.2, length: 6, height: 3.2 }, architecturalAnchors: [],
  curatedAssets: [[0, 0, -1.32], [-3, 0, -2.4], [-1.7, 0, 1], [1.7, 0, 1]].map((p, i) => ({
    sku: i === 1 ? "Cinnamon Gardens Floor Lamp" : "Sandy Cove Sofa", componentId: String(i), glbUrl: "test.glb",
    position: p as [number, number, number], rotation: [0, 0, 0], scale: [1, 1, 1], priceAtCuration: 1,
  })), financialSummary: { totalBudget: 10, allocatedSpend: 4, remainingBuffer: 6 },
};
describe("cinematic safety", () => {
  it("offers distinct safe presets with slower orbit and synchronized furniture targets", () => {
    const sweep = buildCinematicPath(scene);
    for (const preset of ["slow-orbit", "furniture-tour"] as const) {
      const path = buildCinematicPath(scene, 120, 24, preset);
      expect(path).not.toBeNull();
      if (!path) return;
      expect(path.samples).not.toEqual(sweep?.samples);
      expect(path.durationSec).toBeGreaterThanOrEqual(preset === "slow-orbit" ? 40 : 32);
      for (const p of path.curve.getPoints(2000)) {
        expect(p.y).toBeGreaterThanOrEqual(1.74);
        expect(p.y).toBeLessThan(3);
        expect(Math.abs(p.x)).toBeLessThan(3.35);
        expect(Math.abs(p.z)).toBeLessThan(2.75);
      }
      const payload = buildSceneVideoPayload(scene, path, "Neutral luxury");
      expect(payload.camera.path).toEqual(path.samples);
      expect(JSON.stringify(payload)).not.toContain("priceAtCuration");
      if (preset === "slow-orbit") {
        expect(path.curve.getPoint(0).distanceTo(path.curve.getPoint(1))).toBeLessThan(0.001);
      } else {
        expect(path.lookAtSamples).toHaveLength(120);
        expect(payload.camera.lookAtPath).toEqual(path.lookAtSamples);
        expect(path.lookAtSamples?.[0]).not.toEqual(path.lookAtSamples?.[119]);
      }
      expect(buildCinematicPath({ ...scene, curatedAssets: [] }, 120, 24, preset)).toBeNull();
      expect(buildCinematicPath({ ...scene, curatedAssets: scene.curatedAssets.map((a) => ({ ...a, scale: [2, 2, 2] })) }, 120, 24, preset)).toBeNull();
    }
  });
  it("supports a furniture tour with a single piece", () => {
    const path = buildCinematicPath({ ...scene, curatedAssets: scene.curatedAssets.slice(0, 1) }, 120, 24, "furniture-tour");
    expect(path).not.toBeNull();
    expect(path?.lookAtSamples?.flat().every(Number.isFinite)).toBe(true);
  });
  it("keeps the entire curve inside the room and above fitted furniture", () => {
    const path = buildCinematicPath(scene);
    expect(path).not.toBeNull();
    for (const p of path?.curve.getPoints(2000) ?? []) {
      expect(p.y).toBeGreaterThanOrEqual(1.74);
      expect(p.y).toBeLessThan(3);
      expect(Math.abs(p.x)).toBeLessThan(3.35);
      expect(Math.abs(p.z)).toBeLessThan(2.75);
    }
    expect(path?.durationSec).toBeGreaterThanOrEqual(24);
  });
  it("refuses an unsafe low ceiling with scaled furniture", () => {
    expect(buildCinematicPath({ ...scene, curatedAssets: scene.curatedAssets.map((a) => ({ ...a, scale: [2, 2, 2] })) })).toBeNull();
  });
  it("handles empty scenes and monotonic, steady cruise timing", () => {
    expect(buildCinematicPath({ ...scene, curatedAssets: [] })).toBeNull();
    expect(cinematicProgress(0)).toBe(0); expect(cinematicProgress(1)).toBe(1);
    for (let i = 1; i <= 100; i++) expect(cinematicProgress(i / 100)).toBeGreaterThanOrEqual(cinematicProgress((i - 1) / 100));
    expect(cinematicProgress(0.51) - cinematicProgress(0.5)).toBeCloseTo(cinematicProgress(0.31) - cinematicProgress(0.3), 8);
  });
});
