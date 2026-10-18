import { describe, expect, it } from "vitest";
import { felixFinishLabel, felixQuoteFinishes, resolveFelixCatalogueFinishes } from "./felixQuoteFinishes";
import { updateFelixProductSelection } from "./updateFelixProductSelection";
import { prepareFelixQuote } from "./felixQuoteSave";

describe("Felix selected finish snapshot", () => {
  it("does not choose arbitrary finishes from repeated dimension labels", () => {
    expect(resolveFelixCatalogueFinishes({ size_variants: [{ label: "Large", base: "Oak", top: "Onyx" }, { label: "Large", base: "Ash", top: "Marble" }] }, "Large", [])).toEqual([]);
  });
  it("resolves rod and diffuser labels independently rather than Base and Top", () => {
    expect(resolveFelixCatalogueFinishes({ base_axis_label: "Rod", top_axis_label: "Diffuser", size_variants: [{ base: "Patinated Bronze", top: "Alabaster", label: "Large" }] }, "Patinated Bronze — Alabaster — Large", [
      { name: "Patinated Bronze", image_url: "https://example.com/bronze.jpg" }, { name: "Alabaster", image_url: "https://example.com/alabaster.jpg" },
    ])).toEqual([{ label: "Rod Finish", name: "Patinated Bronze", imageUrl: "https://example.com/bronze.jpg" }, { label: "Diffuser", name: "Alabaster", imageUrl: "https://example.com/alabaster.jpg" }]);
  });
  it("keeps dimensions out of finish rows", () => {
    expect(resolveFelixCatalogueFinishes({ base_axis_label: "Size", top_axis_label: "Finish", size_variants: [{ base: "180 x 90 cm", top: "Smoked Oak" }] }, "180 x 90 cm — Smoked Oak", [{ name: "Smoked Oak", image_url: "https://example.com/oak.jpg" }])).toEqual([{ label: "Finish", name: "Smoked Oak", imageUrl: "https://example.com/oak.jpg" }]);
  });
  it("does not choose an arbitrary colourway for a fabric range", () => {
    expect(resolveFelixCatalogueFinishes({}, "AVA Range", [{ name: "AVA - Ecru", image_url: "ecru.jpg" }, { name: "AVA - Grey", image_url: "grey.jpg" }])).toEqual([{ label: "Finish", name: "AVA Range", imageUrl: undefined }]);
  });
  it("preserves three independently labelled materials through saving", () => {
    const finishes = [{ label: "Wood Finish", name: "Oak", imageUrl: "oak.jpg" }, { label: "Stone Finish", name: "Onyx", imageUrl: "onyx.jpg" }, { label: "Metal Finish", name: "Bronze", imageUrl: "bronze.jpg" }];
    expect(prepareFelixQuote([{ productId: "yoma", productName: "Yoma", finishes }], "quote")[0].finishes).toEqual(finishes);
  });
  it("retains Frame Finish and Upholstery Fabric with the selected swatches across update and save", () => {
    const finishes = [
      { label: felixFinishLabel("Select Your Frame Finish", "Base"), name: "Oak", imageUrl: "https://example.com/oak.jpg" },
      { label: felixFinishLabel("Select Your Upholstery Fabric", "Top"), name: "AVA Range", imageUrl: "https://example.com/ava.jpg" },
    ];
    const selection = { productId: "cloud", productName: "Cloud Stratus", finishes, unitPriceCents: 481500, quantity: 3 };
    const timeline = updateFelixProductSelection([{ kind: "proactive_tearsheet", data: selection }], selection);
    const [saved] = prepareFelixQuote([timeline[0].data], "quote");
    expect(felixQuoteFinishes(saved)).toEqual([
      { label: "Frame Finish", name: "Oak", imageUrl: "https://example.com/oak.jpg" },
      { label: "Upholstery Fabric", name: "AVA Range", imageUrl: "https://example.com/ava.jpg" },
    ]);
    expect(saved.unitPriceCents).toBe(481500);
  });
});