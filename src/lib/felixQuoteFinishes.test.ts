import { describe, expect, it } from "vitest";
import { felixFinishLabel, felixQuoteFinishes } from "./felixQuoteFinishes";
import { updateFelixProductSelection } from "./updateFelixProductSelection";
import { prepareFelixQuote } from "./felixQuoteSave";

describe("Felix selected finish snapshot", () => {
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