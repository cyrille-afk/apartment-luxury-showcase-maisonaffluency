import { afterEach, describe, expect, it } from "vitest";
import { buildCustomCinematicPath, checkPathClearance, nodesFromDescription, persistCustomPath, readLocalPaths } from "./customCameraPaths";
import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";

const scene: AICuratedSceneSchema = {
  roomDimensions: { width: 7.2, length: 6, height: 3.2 }, architecturalAnchors: [],
  curatedAssets: [[0, 0, -1.3], [-1.7, 0, 1]].map((p, i) => ({ sku: i ? "Lamp" : "Sofa", componentId: String(i), glbUrl: "x.glb",
    position: p as [number, number, number], rotation: [0, 0, 0], scale: [1, 1, 1], priceAtCuration: 1 })),
  financialSummary: { totalBudget: 10, allocatedSpend: 2, remainingBuffer: 8 },
};

describe("custom camera paths", () => {
  afterEach(() => window.localStorage.clear());
  it("needs two nodes and clamps every point inside the room", () => {
    expect(buildCustomCinematicPath(scene, [{ position: [0, 2, 0], target: [0, 0.6, 0] }])).toBeNull();
    const path = buildCustomCinematicPath(scene, [{ position: [99, 99, 99], target: [0, 0.6, 0] }, { position: [-99, -5, -99], target: [1, 0.6, 0] }]);
    expect(path).not.toBeNull();
    for (const p of path?.curve.getPoints(500) ?? []) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(3.2001); expect(Math.abs(p.z)).toBeLessThanOrEqual(2.6001);
      expect(p.y).toBeGreaterThanOrEqual(0.4999); expect(p.y).toBeLessThanOrEqual(3.0001);
    }
    expect(path?.lookAtSamples).toHaveLength(120);
  });
  it("builds nodes from a description via validated presets", () => {
    expect(nodesFromDescription(scene, "slow orbit around the room").length).toBeGreaterThan(1);
  });
  it("saves browser-only paths per layout", async () => {
    await persistCustomPath("local", { id: "a", name: "Test", mode: "capture", nodes: [{ position: [0, 2, 0], target: [0, 0, 0] }, { position: [1, 2, 0], target: [0, 0, 0] }] }, "L1");
    expect(readLocalPaths("L1")).toHaveLength(1);
    expect(readLocalPaths("L2")).toHaveLength(0);
  });
});

describe("custom path clearance", () => {
  it("flags a path through furniture and clears an elevated one", () => {
    const low = buildCustomCinematicPath(scene, [{ position: [-2, 0.8, -1.3], target: [0, 0.6, 0] }, { position: [2, 0.8, -1.3], target: [0, 0.6, 0] }]);
    const hits = checkPathClearance(scene, low);
    expect(hits.map((h) => h.label)).toContain("Sofa");
    const high = buildCustomCinematicPath(scene, [{ position: [-2, 2.4, -1.3], target: [0, 0.6, 0] }, { position: [2, 2.4, -1.3], target: [0, 0.6, 0] }]);
    expect(checkPathClearance(scene, high)).toEqual([]);
  });
  it("flags architectural anchors", () => {
    const withDoor = { ...scene, architecturalAnchors: [{ type: "door" as const, position: [0, 1, 2] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 2, 0.5] as [number, number, number] }] };
    const path = buildCustomCinematicPath(withDoor, [{ position: [-1, 1, 2], target: [0, 0, 0] }, { position: [1, 1, 2], target: [0, 0, 0] }]);
    expect(checkPathClearance(withDoor, path).some((h) => h.kind === "door")).toBe(true);
  });
});
