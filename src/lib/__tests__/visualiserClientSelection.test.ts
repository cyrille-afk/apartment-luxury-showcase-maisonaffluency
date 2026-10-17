import { describe, expect, it } from "vitest";
import { visualiserClientSelection } from "../visualiserClientSelection";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";

const piece = { id: "chair", instanceId: "one", product_name: "Chair", brand_name: "Maker", image_url: null, dimensions: null, glb_url: null, position: [1, 0, 2], rotation: [0, 1, 0], scale: 1 } as PlacedObject;
const finish = (name: string) => ({ id: name, name, brand_name: "Maker", category: "Wood", material_type: null, color_family: null, image_url: null });

describe("Visualiser private client selection", () => {
  it("preserves upholstery and base selections for client review", () => {
    expect(visualiserClientSelection([{ ...piece, upholsteryMaterial: finish("Suede"), baseMaterial: finish("Oak") }]))
      .toEqual([{ product_id: "chair", fabric_label: "Suede", wood_label: "Oak", variant_label: null }]);
  });
  it("keeps individually placed copies with their independent finishes", () => {
    const result = visualiserClientSelection([{ ...piece, topMaterial: finish("Onyx") }, { ...piece, instanceId: "two", topMaterial: finish("Travertine") }]);
    expect(result.map((p) => p.fabric_label)).toEqual(["Onyx", "Travertine"]);
    expect(result).toHaveLength(2);
  });
  it("retains additional part finishes without exporting trade prices or scene internals", () => {
    const result = visualiserClientSelection([{ ...piece, material: finish("Bronze"), partMaterials: { drawer: finish("Leather"), frame: finish("Bronze") }, trade_price_cents: 10000 } as PlacedObject]);
    expect(result[0]).toEqual({ product_id: "chair", fabric_label: null, wood_label: null, variant_label: "Bronze / Leather" });
    expect(result[0]).not.toHaveProperty("trade_price_cents");
    expect(result[0]).not.toHaveProperty("position");
  });
});