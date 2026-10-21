import { describe, expect, it } from "vitest";
import { createPlacedObject, inventoryItemToPlaceable, removeInventoryPlacements } from "./placedObjectFactory";
import type { ProjectInventoryItem } from "@/contexts/ProjectInventoryContext";
import { layoutItems } from "./activeProjectLayout";

const item: ProjectInventoryItem = {
  instanceId: "configured-one", id: "madison", productName: "Madison Avenue Side Table",
  brandName: "Yabu Pushelberg", dimensions: "27 × 27 × 50 cm", imageUrl: null, glbUrl: null,
  variantLabel: "Oak", selectedFrameFinish: "Oak", finishes: ["Oak"], addedAt: 1,
};

describe("project asset deletion lifecycle", () => {
  it("purges every placement of the removed instance and all derived plan labels", () => {
    const placed = createPlacedObject(inventoryItemToPlaceable(item), [1, 0, 2]);
    const objects = [placed, { ...placed, instanceId: "second-placement" }];
    const remaining = removeInventoryPlacements(objects, item);
    expect(remaining).toEqual([]);
    expect(layoutItems(remaining)).toEqual([]);
  });
  it("preserves another configured instance of the same product", () => {
    const first = createPlacedObject(inventoryItemToPlaceable(item), [0, 0, 0]);
    const other = createPlacedObject(inventoryItemToPlaceable({ ...item, instanceId: "configured-two" }), [2, 0, 0]);
    expect(removeInventoryPlacements([first, other], item)).toEqual([other]);
  });
  it("purges legacy orphan vectors but preserves other finishes and catalogue copies", () => {
    const legacy = { ...createPlacedObject(inventoryItemToPlaceable(item), [0, 0, 0]), inventoryInstanceId: undefined };
    const differentFinish = { ...legacy, selectedFrameFinish: "Walnut", finishes: ["Walnut"] };
    const catalogue = { ...legacy, variantLabel: null, finishes: [] };
    expect(removeInventoryPlacements([legacy, differentFinish, catalogue], item)).toEqual([differentFinish, catalogue]);
  });
  it("retains provenance through saved scene restoration", () => {
    const restored = JSON.parse(JSON.stringify([createPlacedObject(inventoryItemToPlaceable(item), [0, 0, 0])]));
    expect(restored[0].inventoryInstanceId).toBe("configured-one");
    expect(removeInventoryPlacements(restored, item)).toEqual([]);
  });
});