import { describe, expect, it } from "vitest";
import { isCollectionLanding, isProductDetailPath, shouldResetRouteScroll } from "./collectionScrollPolicy";

describe("Collection scroll ownership", () => {
  it("lets both Trade product URLs and public product URLs own their content-ready reset", () => {
    expect(isProductDetailPath("/trade/products/4c5447ce-abd1-4c16-80a7-c3c41738f7a8")).toBe(true);
    expect(isProductDetailPath("/trade/products/michel-amar-studio/puzzle-dining-table")).toBe(true);
    expect(isProductDetailPath("/designers/michel-amar-studio/jules-lamp")).toBe(true);
    expect(isProductDetailPath("/trade/gallery/michel-amar-studio")).toBe(false);
  });
  it("resets repeated Collection navigation to the heading", () => {
    expect(shouldResetRouteScroll("/trade/the-collection", "/trade/the-collection")).toBe(true);
  });
  it("does not reset unrelated same-page filters", () => {
    expect(shouldResetRouteScroll("/designers", "/designers")).toBe(false);
  });
  it("excludes Collection from resize anchor restoration", () => {
    expect(isCollectionLanding("/trade/the-collection")).toBe(true);
    expect(isCollectionLanding("/trade/the-collection/")).toBe(true);
    expect(isCollectionLanding("/trade/gallery/thierry-lemaire")).toBe(false);
  });
});