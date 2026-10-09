import { describe, expect, it } from "vitest";
import { buildSpecSheetUrl } from "./specSheetUrl";

describe("buildSpecSheetUrl", () => {
  it("opens the Geo lamp sheet on production with its exact selection", () => {
    const url = new URL(buildSpecSheetUrl(
      "https://assets.example/geo.pdf", "Alexander Lamont", "Geo Table Lamp",
      "Geo Table Lamp Natural Speckle Shagreen  Specsheet", 1,
    ));
    expect(url.origin).toBe("https://maisonaffluency.com");
    expect(url.pathname).toBe("/trade/spec-sheet");
    expect(url.searchParams.get("brand")).toBe("Alexander Lamont");
    expect(url.searchParams.get("product")).toBe("Geo Table Lamp");
    expect(url.searchParams.get("sheet")).toBe("Geo Table Lamp Natural Speckle Shagreen  Specsheet");
    expect(url.searchParams.get("sheetIndex")).toBe("1");
    expect(url.href).not.toContain("assets.example");
  });

  it("uses production for single sheets too and omits invalid indices", () => {
    expect(buildSpecSheetUrl("ignored", "A & B", "Lamp / One", undefined, NaN))
      .toBe("https://maisonaffluency.com/trade/spec-sheet?brand=A+%26+B&product=Lamp+%2F+One");
  });
});
describe("buildSpecSheetUrl origin", () => {
  it("keeps the signed-in www origin", () => {
    const orig = window.location;
    Object.defineProperty(window, "location", { value: new URL("https://www.maisonaffluency.com/trade/products/x"), configurable: true });
    expect(buildSpecSheetUrl("x", "A", "B").startsWith("https://www.maisonaffluency.com/trade/spec-sheet?")).toBe(true);
    Object.defineProperty(window, "location", { value: orig, configurable: true });
  });
});
