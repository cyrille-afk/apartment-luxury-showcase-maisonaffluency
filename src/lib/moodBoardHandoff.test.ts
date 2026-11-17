import { expect, it } from "vitest";
import { moodBoardHandoff } from "./moodBoardHandoff";
it("hands off every selected piece including unpriced and model-less pieces with room type", () => {
  const pieces = Array.from({ length: 17 }, (_, i) => ({ id: String(i), product_name: "Chair", image_url: "chair.jpg", dimensions: "80 × 80 cm", glb_url: i ? "chair.glb" : null, retailCents: i ? 300000 : null, width_mm: 800, depth_mm: 800 }));
  const layout = moodBoardHandoff(pieces, "project", "bedroom", null, 123);
  expect(layout.items).toHaveLength(17);
  expect(layout.items[0]).toMatchObject({ productId: "0", glbUrl: null, priceEur: null, imageUrl: "chair.jpg", dimensions: "80 × 80 cm" });
  expect(layout).toMatchObject({ projectId: "project", roomType: "bedroom", updatedAt: 123 });
  expect(new Set(layout.items.map(i => `${i.x},${i.z}`)).size).toBe(17);
});
it("puts the pinned Anchor first and retains its real dimensions for the loading queue", () => {
  const layout = moodBoardHandoff([
    { id: "chair", product_name: "Lounge Chair", glb_url: "chair.glb", retailCents: 100, width_mm: 800, depth_mm: 800, height_mm: 750, category: "Lounge Chairs" },
    { id: "sofa", product_name: "Sofa", glb_url: "sofa.glb", retailCents: 200, width_mm: 2200, depth_mm: 950, height_mm: 800, category: "Sofas" },
  ], "project", "living", null, 456, null, "sofa");
  expect(layout.anchorId).toBe("sofa");
  expect(layout.items[0]).toMatchObject({ productId: "sofa", x: 0, z: 0, rotationY: 0, width_mm: 2200, depth_mm: 950, height_mm: 800 });
});
it("uses saved size variants when board rows have no separate dimension columns", () => {
  const layout = moodBoardHandoff([
    { id: "sofa", product_name: "Sofa", glb_url: null, retailCents: null, size_variants: [{ label: "W 220 D 95 H 80 cm" }] },
    { id: "coffee", product_name: "Coffee Table", glb_url: null, retailCents: null, size_variants: [{ label: "W 100 D 60 H 35 cm" }] },
  ], "project", "living", null, 789);
  expect(layout.items.find(item => item.productId === "coffee")?.z).toBeCloseTo((0.95 + 0.6) / 2 + 0.45);
});
it("retains each configured copy's locked finishes in the Sandbox handoff", () => {
  const layout = moodBoardHandoff([{ id: "chair", product_name: "Chair", glb_url: null, retailCents: 100, appearance: { finishesLocked: true, upholsteryMaterial: { id: "fabric-blue" } } }, { id: "chair", product_name: "Chair", glb_url: null, retailCents: 200, appearance: { finishesLocked: false, upholsteryMaterial: { id: "fabric-red" } } }], "project", "living", null, 456);
  expect(layout.items.map(item => item.appearance)).toEqual([{ finishesLocked: true, upholsteryMaterial: { id: "fabric-blue" } }, { finishesLocked: false, upholsteryMaterial: { id: "fabric-red" } }]);
});