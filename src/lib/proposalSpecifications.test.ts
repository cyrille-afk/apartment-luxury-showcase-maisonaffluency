import { describe, expect, it } from "vitest";
import { proposalFinishDetails, proposalMaterialDetails, proposalSpecifications } from "./proposalSpecifications";
import { resolveStudioSelection, type StudioFinishProduct } from "./studioFinishes";

describe("Project proposal specifications", () => {
  it("includes recorded dimensions, materials and selected finish details", () => {
    expect(proposalSpecifications({
      width_mm: 820,
      depth_mm: 770,
      height_mm: 730,
      materials: "Solid oak and wool upholstery",
      finish_details: "Wood Finish: Natural Oak · Upholstery: Opera Delft",
    })).toEqual({
      dimensions: "820 × 770 × 730 mm",
      materials: "Solid oak and wool upholstery",
      finishes: "Wood Finish: Natural Oak · Upholstery: Opera Delft",
    });
  });

  it("preserves unparseable recorded dimensions and marks missing details on request", () => {
    expect(proposalSpecifications({ dimensions: "Made to order", materials: " ", selected_finish: null })).toEqual({
      dimensions: "Made to order",
      materials: "On request",
      finishes: "On request",
    });
  });

  it("labels each saved catalogue finish with its material axis", () => {
    const product: StudioFinishProduct = {
      name: "Chair",
      baseLabel: "Wood Finish",
      topLabel: "Upholstery",
      variants: [{ base: "Natural Oak", top: "Fabric Cat. Opera" }],
      finishes: [
        { id: "oak", name: "Natural Oak", category: "Wood", image_url: null, brand_name: "Maker", material_type: null, color_family: null },
        { id: "fabric", name: "Opera Delft", tier: "Fabric Cat. Opera", category: "Fabric", image_url: null, brand_name: "Maker", material_type: null, color_family: null },
      ],
    };
    expect(proposalFinishDetails(product, resolveStudioSelection(product, null))).toBe("Wood Finish: Natural Oak · Upholstery: Opera Delft");
  });

  it("uses the locked supplier material records even when catalogue materials are empty", () => {
    const product: StudioFinishProduct = {
      name: "Rua Leblon", variants: [], materials: null,
      finishes: [
        { id: "wood", name: "Natural Walnut", category: "Wood", material_type: "Wood", image_url: null, brand_name: "Maker", color_family: null },
        { id: "fabric", name: "Zero 001", category: "Fabric", material_type: "Fabric", image_url: null, brand_name: "Maker", color_family: null },
      ],
    };
    const selection = { ids: { base: "wood", upholstery: "fabric" }, locked: true };
    expect(proposalMaterialDetails(product, selection)).toBe("Wood: Natural Walnut · Fabric: Zero 001");
  });

  it("prefers the actual selection over conflicting catalogue materials", () => {
    const product: StudioFinishProduct = {
      name: "Rift CTS", materials: "White washed oak, brown travertine",
      variants: [{ base: "Bleached Oak", top: "Brown Travertine Sandblasted — Open Pore" }], finishes: [],
    };
    expect(proposalMaterialDetails(product, resolveStudioSelection(product, null)))
      .toBe("Frame / Base: Bleached Oak · Surface: Brown Travertine Sandblasted — Open Pore");
  });

  it("retains recorded prose without selections and leaves genuinely missing materials unknown", () => {
    expect(proposalMaterialDetails({ name: "Piece", variants: [], finishes: [], materials: "Solid oak" }, { ids: {}, locked: true })).toBe("Solid oak");
    expect(proposalMaterialDetails({ name: "Piece", variants: [], finishes: [], materials: null }, { ids: {}, locked: true })).toBeNull();
  });
});
