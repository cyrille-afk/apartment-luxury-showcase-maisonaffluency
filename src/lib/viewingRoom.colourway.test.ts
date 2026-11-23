import { describe, expect, it } from "vitest";
import { viewingRoomSelection, viewingRoomSlotSchema } from "./viewingRoom";
const fabric = (id: string) => ({ id, name: `Perfect Match ${id}`, category: "Fabric & Leather", brand_name: "Zimmer + Rohde", image_url: `https://x.test/${id}.jpg`, material_type: null, color_family: null });
const slot = viewingRoomSlotSchema.parse({ id: "11111111-1111-4111-8111-111111111111", product_name: "Rua Leblon", category: null, subcategory: null, image_url: null, dimensions: null, width_mm: null, depth_mm: null, height_mm: null, glb_url: null, lead_time: null, materials: {}, retail_price: 100, alternatives: [],
  finish_options: [{ key: "1", label: "Fabric Cat. Perfect Match / Natural Walnut", retail_price: 120, image_url: null, lead_time: null, materials: { upholstery: fabric("a") }, colourways: [fabric("a"), fabric("b")] }] });
describe("viewing room fabric colourways", () => {
  it("applies the chosen colourway to the upholstery", () => {
    const choice = viewingRoomSelection(slot, slot.id, "1", undefined, "b");
    expect(choice.materials["upholstery"]?.id).toBe("b");
    expect(choice.colourway_id).toBe("b");
  });
  it("rejects a colourway outside the finish's family", () => {
    expect(() => viewingRoomSelection(slot, slot.id, "1", undefined, "zzz")).toThrow("Unapproved colourway");
  });
});
