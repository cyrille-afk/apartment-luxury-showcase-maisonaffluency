import { describe, it, expect } from "vitest";
import { buildProductCuratorNotes } from "./productCuratorNotes";

describe("buildProductCuratorNotes provenance", () => {
  it("hides Historical Provenance when the description has no historical signal", () => {
    const notes = buildProductCuratorNotes({
      title: "Celia Chair",
      brandName: "Emma Donnersberg",
      description:
        "A sculptural dining chair with a generous curved back. Crafted with an uncompromising eye for detail, the chair's solid wood structure is rendered in noble oak or walnut. Available in a range of upholstery fabrics.",
    });
    expect(notes.provenance).toBeNull();
  });

  it("surfaces the sentence carrying a real historical signal", () => {
    const notes = buildProductCuratorNotes({
      title: "Reedition Lounge Chair",
      brandName: "Ecart",
      description:
        "A lounge chair of quiet presence. Its proportions anchor a room. Originally designed in 1936, this reedition is produced from the archive drawings.",
    });
    expect(notes.provenance).toContain("1936");
  });

  it("never recycles the significance or spatial sentences as provenance", () => {
    const notes = buildProductCuratorNotes({
      title: "Wave Sofa",
      brandName: "Emma Donnersberg",
      description:
        "First sentence. Second sentence. Third sentence without any signal words.",
    });
    expect(notes.provenance).toBeNull();
    expect(notes.significance).toBe("First sentence.");
    expect(notes.spatial).toBe("Second sentence.");
  });
});
