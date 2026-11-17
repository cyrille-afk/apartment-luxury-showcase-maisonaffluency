import { describe, expect, it } from "vitest";
import { proposalDimensionRows, proposalLeadTime, proposalSwatchColor, proposalFinishDetails, proposalFinishSwatches, proposalMaterialDetails, proposalSpecifications } from "./proposalSpecifications";
import { resolveStudioSelection, type StudioFinishProduct } from "./studioFinishes";

describe("Project proposal specifications", () => {
  it("converts recorded W × D × H from cm into mm and inches", () => {
    expect(proposalDimensionRows({ dimensions: "255 × 70 × H 100 cm" })).toEqual({ metric: "2550 × 700 × 1000 mm", imperial: "100.4 × 27.6 × 39.4 in" });
  });
  it("converts the recorded chair measurements without guessing missing axes", () => {
    expect(proposalDimensionRows({ width_mm: 900, depth_mm: 920, height_mm: 760 })).toEqual({ metric: "900 × 920 × 760 mm", imperial: "35.4 × 36.2 × 29.9 in" });
    expect(proposalDimensionRows({ dimensions: "Made to order" }).imperial).toBeNull();
  });
  it("accepts only recorded hex colors for missing sample fallback", () => {
    expect(proposalSwatchColor("#A1b2C3")).toBe("#A1b2C3");
    expect(proposalSwatchColor("Natural Walnut")).toBeUndefined();
  });
  it("uses the longest recorded lead time and flags incomplete estimates", () => {
    expect(proposalLeadTime(["8–12 weeks", "16 weeks"])).toBe("16 weeks");
    expect(proposalLeadTime(["8–12 weeks", null])).toBe("12 weeks · partial estimate");
    expect(proposalLeadTime([null])).toBe("To be confirmed");
  });
  it("exports only selected cropped images without substituting another finish", () => {
    const product: StudioFinishProduct = { name: "Chair", variants: [], finishes: [
      { id: "selected", name: "Opera Calla", category: "Fabric", image_url: "https://example.com/cropped-calla.jpg", brand_name: "Maker", material_type: null, color_family: null },
      { id: "other", name: "Opera Delft", category: "Fabric", image_url: "https://example.com/cropped-delft.jpg", brand_name: "Maker", material_type: null, color_family: null },
    ] };
    expect(proposalFinishSwatches(product, { ids: { upholstery: "selected" }, locked: true })).toEqual([
      { id: "upholstery:selected", axis: "Upholstery", name: "Opera Calla", image_url: "https://example.com/cropped-calla.jpg" },
    ]);
  });
  it("keeps unpictured selected finishes without inventing a sample image", () => {
    expect(proposalFinishSwatches({ name: "Lamp", variants: [{ top: "100 % Linen" }], finishes: [] }, { ids: { top: "catalog:top:100 % Linen" }, locked: true })).toEqual([
      { id: "top:catalog:top:100 % Linen", axis: "Surface", name: "100 % Linen", image_url: null },
    ]);
  });
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
