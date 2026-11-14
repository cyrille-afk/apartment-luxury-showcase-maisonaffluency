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
it("retains each configured copy's locked finishes in the Sandbox handoff", () => {
  const layout = moodBoardHandoff([{ id: "chair", product_name: "Chair", glb_url: null, retailCents: 100, appearance: { finishesLocked: true, upholsteryMaterial: { id: "fabric-blue" } } }, { id: "chair", product_name: "Chair", glb_url: null, retailCents: 200, appearance: { finishesLocked: false, upholsteryMaterial: { id: "fabric-red" } } }], "project", "living", null, 456);
  expect(layout.items.map(item => item.appearance)).toEqual([{ finishesLocked: true, upholsteryMaterial: { id: "fabric-blue" } }, { finishesLocked: false, upholsteryMaterial: { id: "fabric-red" } }]);
});