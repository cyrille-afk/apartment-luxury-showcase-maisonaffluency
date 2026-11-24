import { describe, expect, it } from "vitest";
import { viewingRoomSizeSelection, viewingRoomSelection, viewingRoomSlotSchema } from "./viewingRoom";
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
  it("keeps the chosen colourway when the sofa size changes", () => {
    const sized = viewingRoomSlotSchema.parse({ ...slot, size_options: [{ key: "200 cm", label: "200 cm" }, { key: "240 cm", label: "240 cm" }],
      finish_options: ["200 cm", "240 cm"].map((size, i) => ({ key: String(i + 1), label: "Fabric Cat. Perfect Match", size_key: size, retail_price: 120 + i, image_url: null, lead_time: null, materials: { upholstery: fabric("a") }, colourways: [fabric("a"), fabric("b")] })) });
    const first = viewingRoomSelection(sized, sized.id, "1", "200 cm", "b");
    expect(viewingRoomSizeSelection(sized, first, "240 cm").materials["upholstery"]?.id).toBe("b");
  });
  it("applies wood/stone colourways to both top and base without touching upholstery, across IBO sizes", () => {
    const wood = (id: string, name: string) => ({ id, name, category: "Wood", brand_name: "Delcourt Collection", image_url: `https://x.test/${id}.png`, material_type: null, color_family: null });
    const stone = { id: "ceppo", name: "Ceppo di Sicilia", category: "Stone", brand_name: "Delcourt Collection", image_url: "https://x.test/ceppo.jpg", material_type: null, color_family: null };
    const oakA = wood("oak-a", "Brushed Oak-CH.044.005.B"), oakB = wood("oak-b", "Brushed Oak-CH.841.005.B");
    const ibo = viewingRoomSlotSchema.parse({
      ...slot, product_name: "IBO low table by Christophe Delcourt", retail_price: 1000,
      size_options: [{ key: "120 cm", label: "Low table 120 Ø 120 x H 41 cm" }, { key: "170 cm", label: "Low table 170 W 170 x D 95 x H 41 cm" }],
      finish_options: [
        { key: "1", label: "Brushed Oak", size_key: "120 cm", dimensions: "120 cm", retail_price: 1000, image_url: null, lead_time: null, materials: { top: oakA, base: oakA }, colourways: [oakA, oakB] },
        { key: "2", label: "Ceppo Di Sicilia", size_key: "120 cm", dimensions: "120 cm", retail_price: 2000, image_url: null, lead_time: null, materials: { top: stone, base: stone }, colourways: [stone] },
        { key: "3", label: "Brushed Oak", size_key: "170 cm", dimensions: "170 cm", retail_price: 1100, image_url: null, lead_time: null, materials: { top: oakA, base: oakA }, colourways: [oakA, oakB] },
      ],
    });
    const picked = viewingRoomSelection(ibo, ibo.id, "1", "120 cm", "oak-b");
    expect(picked.materials["top"]?.id).toBe("oak-b");
    expect(picked.materials["base"]?.id).toBe("oak-b");
    expect(picked.materials["upholstery"]).toBeUndefined();
    const resized = viewingRoomSizeSelection(ibo, picked, "170 cm");
    expect(resized.materials["top"]?.id).toBe("oak-b");
    expect(resized.materials["base"]?.id).toBe("oak-b");
    expect(resized.retail_price).toBe(1100);
    const fromStone = viewingRoomSizeSelection(ibo, viewingRoomSelection(ibo, ibo.id, "2", "120 cm", "ceppo"), "170 cm");
    expect(fromStone.finish_key).toBe("3");
    expect(fromStone.materials["top"]?.id).toBe("oak-a");
  });
});
