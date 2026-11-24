import { describe, expect, it } from "vitest";
import { swatchMatrixVariants } from "./FinishesDrawer";

const raw = [
  { top: "", base: "", label: "W 108 × D 108 × H 28 cm - Bleached oak or Smoked", price_cents: 2920200 },
  { top: "", base: "", label: "W 108 × D 108 × H 28 cm - White washed oak or Ebonized Oak", price_cents: 2966500 },
];
const sw = [{ name: "Bleached Oak", category: "Wood" }, { name: "Ebonized Oak", category: "Wood" }, { name: "Brown Travertine Honed — Open Pore", category: "Stone" }];

describe("Rift CTS style finishes", () => {
  it("offers each stone × wood pair priced by the wood's group", () => {
    const v = swatchMatrixVariants(raw, sw);
    expect(v).toHaveLength(2);
    expect(v.find((x) => x.base === "Bleached Oak")?.price_cents).toBe(2920200);
    expect(v.find((x) => x.base === "Ebonized Oak")?.price_cents).toBe(2966500);
  });
});
