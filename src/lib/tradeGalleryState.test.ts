import { beforeEach, expect, it } from "vitest";
import { readTradeGalleryState, saveTradeGalleryState, tradeGalleryReturnPath, isTradeGalleryListing } from "./tradeGalleryState";
beforeEach(() => sessionStorage.clear());
it("preserves gallery filters, view and exact position independently for each designer", () => {
  const state = { search: "console", brand: "Kerstens", category: "Living", subcategory: "Consoles", edition: "Collection", sortBy: "title" as const, viewMode: "list" as const, scrollY: 1470 };
  saveTradeGalleryState("/trade/gallery/kerstens", state, "?category=Living&subcategory=Consoles");
  expect(readTradeGalleryState("/trade/gallery/kerstens")).toEqual(state);
  expect(readTradeGalleryState("/trade/gallery/okha")).toEqual({});
  expect(tradeGalleryReturnPath()).toBe("/trade/gallery/kerstens?category=Living&subcategory=Consoles");
});
it("designer profiles and curator picks never overwrite the originating gallery", () => {
  expect(isTradeGalleryListing("/trade/gallery/kerstens/profile")).toBe(false);
  expect(isTradeGalleryListing("/trade/gallery/kerstens/biography")).toBe(false);
  expect(isTradeGalleryListing("/trade/gallery")).toBe(true);
});
it("rejects external return destinations", () => {
  sessionStorage.setItem("ma-trade-gallery-v1:return", "https://example.com");
  expect(tradeGalleryReturnPath()).toBe("/trade/the-collection?tab=designers");
});