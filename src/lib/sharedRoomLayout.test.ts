import { describe, expect, it } from "vitest";
import { sharedBudget, sharedToScene, type SharedRoomLayout } from "./sharedRoomLayout";

const layout: SharedRoomLayout = {
  projectId: "p1", room: { width: 7.2, length: 6, height: 3.2 }, source: "visualiser", updatedAt: 0,
  items: [
    { productId: "sofa", name: "Sofa", glbUrl: "s.glb", x: 0.5, z: -1, rotationY: 0.3, priceEur: 24000 },
    { productId: "lamp", name: "Lamp", glbUrl: "l.glb", x: 2, z: 2, rotationY: 0, priceEur: null },
  ],
};

describe("shared room layout", () => {
  it("allocates priced pieces against the €60,000 budget and leaves POR out", () => {
    expect(sharedBudget(layout.items, 60000)).toEqual({ totalBudget: 60000, allocatedSpend: 24000, remainingBuffer: 36000 });
  });
  it("keeps the 3D X/Z placement and rotation on the curated grid", () => {
    const scene = sharedToScene(layout, 60000);
    expect(scene.curatedAssets[0].position).toEqual([0.5, 0, -1]);
    expect(scene.curatedAssets[0].rotation).toEqual([0, 0.3, 0]);
    expect(scene.financialSummary.remainingBuffer).toBe(36000);
  });
});
