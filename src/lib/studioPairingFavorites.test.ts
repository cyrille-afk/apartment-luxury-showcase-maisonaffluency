import { expect, it } from "vitest";
import { rankStudioPairings, type PairingProduct } from "./studioPairings";

it("revisits saved pairings outside the eight-result stream without the per-role cap", () => {
  const reference: PairingProduct = { id: "chair", product_name: "Reference Chair", brand_name: "Maker", category: "Seating", subcategory: null, materials: "oak", materials_description: null, default_variant_label: null, image_url: "chair.jpg" };
  const catalogue = Array.from({ length: 12 }, (_, index) => ({ ...reference, id: `table-${index}`, product_name: `Side Table ${index}`, category: "Tables" }));
  expect(rankStudioPairings(reference, catalogue, [])).toHaveLength(3);
  const saved = rankStudioPairings(reference, catalogue, [], { perRole: 12, total: 12 });
  expect(saved).toHaveLength(12);
  expect(new Set(saved.map(product => product.product_id)).size).toBe(12);
  expect(rankStudioPairings(reference, catalogue, ["table-11"], { perRole: 12, total: 12 }).some(product => product.product_id === "table-11")).toBe(false);
});