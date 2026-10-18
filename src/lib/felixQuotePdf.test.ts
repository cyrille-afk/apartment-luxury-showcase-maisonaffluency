import { describe, expect, it } from "vitest";
import { felixPdfLines } from "./felixQuotePdf";
describe("Felix PDF current-selection snapshot", () => {
  it("exports exact configured fabric, quantity and matching line price", () => {
    const [line] = felixPdfLines([{ productId: "cloud", productName: "Cloud Stratus", fabricLabel: "AVA Range", baseLabel: "Oak", quantity: 3, unitPriceCents: 481500, priceCurrency: "EUR" }]);
    expect(line).toMatchObject({ fabricLabel: "AVA Range", baseLabel: "Oak", quantity: 3, unitPriceCents: 481500, lineTotalCents: 1444500 });
  });
  it("keeps a missing price as Price upon Request data", () => {
    expect(felixPdfLines([{ productId: "unknown", productName: "Unknown", quantity: 2, unitPriceCents: null }])[0].lineTotalCents).toBeNull();
  });
});