import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSpecSheetUrl, openSpecSheet, SPEC_SHEET_NAVIGATE_EVENT } from "./specSheetUrl";

const realLocation = window.location;
const at = (href: string) =>
  Object.defineProperty(window, "location", { value: new URL(href), configurable: true });

afterEach(() => {
  Object.defineProperty(window, "location", { value: realLocation, configurable: true });
  vi.restoreAllMocks();
});

describe("buildSpecSheetUrl", () => {
  it("opens the Geo lamp sheet with its exact selection", () => {
    at("https://maisonaffluency.com/trade/products/x");
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

  it("falls back to production on unknown hosts and omits invalid indices", () => {
    at("https://evil.example/page");
    expect(buildSpecSheetUrl("ignored", "A & B", "Lamp / One", undefined, NaN))
      .toBe("https://maisonaffluency.com/trade/spec-sheet?brand=A+%26+B&product=Lamp+%2F+One");
  });

  it("keeps the signed-in www origin", () => {
    at("https://www.maisonaffluency.com/trade/products/x");
    expect(buildSpecSheetUrl("x", "A", "B").startsWith("https://www.maisonaffluency.com/trade/spec-sheet?")).toBe(true);
  });
});

describe("openSpecSheet", () => {
  it("opens our own viewer in the same tab, never a new tab", () => {
    at("https://www.maisonaffluency.com/trade/products/x");
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const seen: string[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent<string>).detail);
    window.addEventListener(SPEC_SHEET_NAVIGATE_EVENT, listener);
    openSpecSheet(buildSpecSheetUrl("x", "Entrelacs", "BEAM Wall Lamp"));
    window.removeEventListener(SPEC_SHEET_NAVIGATE_EVENT, listener);
    expect(open).not.toHaveBeenCalled();
    expect(seen).toEqual(["/trade/spec-sheet?brand=Entrelacs&product=BEAM+Wall+Lamp"]);
  });
});
