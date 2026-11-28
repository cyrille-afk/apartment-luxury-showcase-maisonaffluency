import { describe, expect, it } from "vitest";
import { surfaceMetricSize, surfaceEditPrompt, isEyeLevelSurface } from "../../supabase/functions/_shared/eyeLevelSurfaces";
import { requireEyeLevelTargets } from "../../supabase/functions/_shared/eyeLevelPlacement";
import { surfaceCatalogueMetadata } from "./eyeLevelSurfaceCatalogue";
import { restoreProposalRenderDraft } from "./proposalRenderDraft";

describe("2D catalogue surfaces", () => {
  it("admits rugs and artwork without any model metadata, but not other pieces", () => {
    expect(isEyeLevelSurface({ category_role: "rug" })).toBe(true);
    expect(isEyeLevelSurface({ category_role: "artwork" })).toBe(true);
    expect(isEyeLevelSurface({ category_role: "chair" })).toBe(false);
  });
  it("rug sizing uses width and depth, never height", () => {
    expect(surfaceMetricSize({ product_name: "Rug", category_role: "rug", width_m: 2.3, depth_m: 3, height_m: 0.01 })).toBe("2.3 × 3 m (W × D)");
  });
  it("artwork sizing uses width and height, never depth", () => {
    expect(surfaceMetricSize({ product_name: "Artwork", category_role: "artwork", width_m: 1.2, height_m: 0.8, depth_m: 0.03 })).toBe("1.2 × 0.8 m (W × H)");
  });
  it("rejects unconfirmed or nonpositive sizes rather than inventing them", () => {
    expect(() => surfaceMetricSize({ product_name: "Rug", category_role: "rug", width_m: 2 })).toThrow();
    expect(() => surfaceMetricSize({ product_name: "Artwork", category_role: "artwork", width_m: 1, height_m: 0 })).toThrow();
  });
  it("rugs use floor placement without a pin; artwork requires a bounded wall pin", () => {
    expect(() => requireEyeLevelTargets([{ product_name: "Rug", category_role: "rug" }])).not.toThrow();
    expect(() => surfaceEditPrompt({ product_name: "Artwork", category_role: "artwork", width_m: 1, height_m: 1 })).toThrow();
    expect(() => surfaceEditPrompt({ product_name: "Artwork", category_role: "artwork", width_m: 1, height_m: 1, target: { x: 101, y: 40, instruction: "" } })).toThrow();
    expect(() => surfaceEditPrompt({ product_name: "Artwork", category_role: "artwork", width_m: 1, height_m: 1, target: { x: 40, y: 30, instruction: "" } })).not.toThrow();
  });
  it("legacy single metric size maps without a model and multi-size strings remain unconfirmed", () => {
    expect(surfaceCatalogueMetadata({ product_name: "Rug", category: "Rugs", dimensions: "230 x 300 cm" })).toEqual({ category_role: "rug", width_m: 2.3, depth_m: 3 });
    expect(surfaceCatalogueMetadata({ product_name: "Rug", category: "Rugs", dimensions: "170x240cm, 200x300cm", width_mm: 1700, depth_mm: 2400 })).toEqual({ category_role: "rug" });
  });
  it("draft reopening retains artwork metric axes and wall coordinates", () => {
    const piece = { id: "art", product_name: "Artwork", brand_name: "Maker", image_url: "https://example.com/art.png", category_role: "artwork", width_m: 1.2, height_m: 0.8, target: { x: 40, y: 30, instruction: "" } };
    expect(restoreProposalRenderDraft({ sourceKey: "room", products: [piece] }, "room")?.products[0]).toEqual(piece);
  });
});