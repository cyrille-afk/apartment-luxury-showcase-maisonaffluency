import { describe, expect, it } from "vitest";
import { productFinishCombinations } from "./productFinishCombinations";

const swatches = ["Black Pepper Oak", "Natural Walnut", "Pall Stone", "Nero Marquina"].map((name) => ({ name, image_url: `https://samples.example/${name}.jpg` }));
describe("product finish combinations", () => {
  it("preserves recorded base/top pairings with both real textures, without inventing cross-products", () => {
    const pairs = productFinishCombinations([{ base: "Black Pepper Oak", top: "Pall Stone" }, { base: "Natural Walnut", top: "Nero Marquina" }], swatches);
    expect(pairs.map(({ base, top }) => [base, top])).toEqual([["Black Pepper Oak", "Pall Stone"], ["Natural Walnut", "Nero Marquina"]]);
    expect(pairs[0].baseTextureUrl).toBe("https://samples.example/Black Pepper Oak.jpg");
    expect(pairs[0].topTextureUrl).toBe("https://samples.example/Pall Stone.jpg");
  });
  it("deduplicates sizes and excludes pairs with missing textures", () => {
    expect(productFinishCombinations([{ base: "Black Pepper Oak", top: "Pall Stone", label: "Small" }, { base: "Black Pepper Oak", top: "Pall Stone", label: "Large" }, { base: "Missing", top: "Pall Stone" }], swatches)).toHaveLength(1);
  });
  it("retains the selected size availability", () => {
    const pairs = productFinishCombinations([{ base: "Black Pepper Oak", top: "Pall Stone", label: "Small" }, { base: "Natural Walnut", top: "Nero Marquina", label: "Large" }], swatches, "Large");
    expect(pairs.map((p) => p.base)).toEqual(["Natural Walnut"]);
  });
});