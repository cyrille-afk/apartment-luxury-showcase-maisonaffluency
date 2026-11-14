import { describe, expect, it } from "vitest";
import { studioDefaultBoardItem } from "./moodBoardStudioTransfer";

describe("Mood Board Studio default configuration", () => {
  it("attaches default frame and upholstery labels for Studio restoration", () => {
    expect(studioDefaultBoardItem("chair", { name: "Chair", baseLabel: "Frame", topLabel: "Upholstery", variants: [{ base: "Black Pepper Oak", top: "Safire-20007" }], finishes: [] })).toEqual({ product_id: "chair", wood_label: "Black Pepper Oak", fabric_label: "Safire-20007", variant_label: null });
  });
  it("carries both the base and top without losing surface finishes", () => {
    expect(studioDefaultBoardItem("table", { name: "Table", baseLabel: "Base", topLabel: "Top", variants: [{ base: "Aged Brass", top: "Pakistani Onyx" }], finishes: [] })).toEqual({ product_id: "table", wood_label: "Aged Brass", fabric_label: null, variant_label: "Pakistani Onyx" });
  });
});