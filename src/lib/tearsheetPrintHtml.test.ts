import { describe, expect, it } from "vitest";
import { buildTearsheetPrintHtml } from "./tearsheetPrintHtml";

const input = {
  selectedProduct: { product_name: "Saint Honoré Sofa", trade_price_cents: 2034000, currency: "EUR" },
  chosenFinishes: { fabric: "Mohair", wood: "Oak" },
  dimensionsDisplay: "280 cm", materialsDisplay: "Oak", leadTimeDisplay: "16 weeks",
};
describe("presentation tearsheet prices", () => {
  it("omits the internal price value completely from presentation exports", () => {
    const html = buildTearsheetPrintHtml({ ...input, presentation: true });
    expect(html).not.toContain("20,340");
    expect(html).not.toContain("20340");
  });
  it("keeps the internal price in default Trade exports", () => {
    expect(buildTearsheetPrintHtml(input)).toContain("20,340");
  });
});