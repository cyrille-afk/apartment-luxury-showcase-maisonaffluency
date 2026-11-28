import { expect, it } from "vitest";
import { approvedVisualizationPieces, residenceShellsSchema, visualizationPlacements, visualizationSignature } from "./residenceVisualization";
import type { ViewingRoomSlot } from "./viewingRoom";

const material = { id: "oak", name: "Brushed Elm", category: "Wood", brand_name: "Delcourt", image_url: "https://example.com/elm.jpg", material_type: null, color_family: null };
const slot: ViewingRoomSlot = { id: "11111111-1111-4111-8111-111111111111", product_name: "IBO", brand_name: "Delcourt", category: "Tables", subcategory: null, image_url: "https://example.com/ibo.jpg", dimensions: "120 cm", width_mm: 1200, depth_mm: 1200, height_mm: 410, glb_url: null, lead_time: null, materials: { base: material }, retail_price: 100, retail_price_from: false, size_options: [], finish_options: [], alternatives: [], is_swappable: false, allow_finish_customization: true };
it("stores labelled durable residence shells as an array", () => {
  expect(residenceShellsSchema.parse([{ label: "Living Room View", url: "https://example.com/living.png" }])).toHaveLength(1);
  expect(residenceShellsSchema.safeParse([{ label: "Living", url: "data:image/png;base64,test" }]).success).toBe(false);
});
it("requires every buyer collection item exactly once", () => {
  expect(() => approvedVisualizationPieces([slot],[])).toThrow();
  expect(() => approvedVisualizationPieces([slot, { ...slot,id: "second" }],[{slot_id:slot.id,product_id:slot.id},{slot_id:slot.id,product_id:slot.id}])).toThrow();
  expect(approvedVisualizationPieces([slot],[{slot_id:slot.id,product_id:slot.id}])[0]?.product_name).toBe("IBO");
});
it("rejects unapproved furniture or finish names before generation", () => {
  expect(() => approvedVisualizationPieces([slot],[{slot_id:slot.id,product_id:"other"}])).toThrow();
  expect(() => approvedVisualizationPieces([slot],[{slot_id:slot.id,product_id:slot.id,finish_key:"invented"}])).toThrow();
});
it("passes exact recorded finish names and photos without prices", () => {
  const placement = visualizationPlacements([slot])[0];
  expect(placement?.image_url).toBe("https://example.com/ibo.jpg");
  expect(placement?.selected_finishes).toEqual([{axis:"Frame / base",name:"Brushed Elm",image_url:"https://example.com/elm.jpg"}]);
  expect(placement).not.toHaveProperty("retail_price");
});
it("invalidates PDF attachment when a furniture finish changes", () => {
  expect(visualizationSignature([slot])).not.toBe(visualizationSignature([{ ...slot, materials:{ base:{ ...material,name:"Black Oak" } } }]));
  expect(visualizationSignature([slot])).toBe(visualizationSignature([{ ...slot, image_url:"https://example.com/new-photo.jpg" }]));
});