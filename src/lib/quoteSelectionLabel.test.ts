import { describe, expect, it } from "vitest";
import { quoteSelectionLabel } from "./quoteSelectionLabel";
import { findQuoteFinishSwatches } from "./quoteFinishSwatches";

describe("persisted quote selections", () => {
  it("records Yoma's three actual finishes even when no pricing axis was committed", () => {
    const finishes = [
      { label: "Wood Finish", name: "Bleached Oak" },
      { label: "Metal Finish", name: "Patinated Bronze — Open Pore" },
      { label: "Stone Finish", name: "Brown Travertine Sandblasted — Open Pore" },
    ];
    const label = quoteSelectionLabel(finishes, null);
    expect(label).toBe("Wood Finish: Bleached Oak · Metal Finish: Patinated Bronze — Open Pore · Stone Finish: Brown Travertine Sandblasted — Open Pore");
    const library = finishes.map((finish, i) => ({ name: finish.name, image_url: `https://images.test/${i}.jpg` }));
    expect(findQuoteFinishSwatches(label, library).map((finish) => finish.name)).toEqual(finishes.map((finish) => finish.name));
  });
  it("saves the chair's selected upholstery and frame, not its fabric price category", () => {
    expect(quoteSelectionLabel([
      { label: "Upholstery", name: "Safire-2 0007" },
      { label: "Frame Finish", name: "Black Pepper Oak" },
    ], "Fabric Cat. Opera")).toBe("Upholstery: Safire-2 0007 · Frame Finish: Black Pepper Oak");
  });
  it("retains explicit size and keeps the existing variant when no finishes are provided", () => {
    expect(quoteSelectionLabel([{ label: "Wood", name: "Oak" }], "old", "W 82 × D 77 × H 73 cm")).toBe("Wood: Oak · W 82 × D 77 × H 73 cm");
    expect(quoteSelectionLabel([], "Size 280")).toBe("Size 280");
  });
});