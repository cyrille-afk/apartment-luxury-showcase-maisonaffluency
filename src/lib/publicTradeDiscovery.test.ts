import { describe, it, expect } from "vitest";
import { isPublicTradeDiscoveryEligible } from "./publicTradeDiscovery";
import { filterTradeProducts } from "./tradeFilter";
import type { TradeProduct } from "./tradeProducts";

const designer = { slug: "collection-particuliere", is_published: true, trade_only: false };
describe("public trade-hidden discovery", () => {
  it("includes publicly listed Collection Particulière despite its trade-hidden status", () => {
    expect(isPublicTradeDiscoveryEligible(designer, true)).toBe(true);
  });
  it("does not surface another hidden house", () => {
    expect(isPublicTradeDiscoveryEligible({ ...designer, slug: "kerstens" }, true)).toBe(false);
  });
  it("does not surface unpublished listings", () => {
    expect(isPublicTradeDiscoveryEligible({ ...designer, is_published: false }, true)).toBe(false);
  });
  it("does not surface trade-only listings", () => {
    expect(isPublicTradeDiscoveryEligible({ ...designer, trade_only: true }, true)).toBe(false);
  });
  it("does not relabel available trade products", () => {
    expect(isPublicTradeDiscoveryEligible(designer, false)).toBe(false);
  });
  it("keeps category and subcategory search narrowing the opted-in pieces", () => {
    const pieces: TradeProduct[] = [
      { id: "pia", product_name: "Pia armchair", brand_name: "Collection Particulière", category: "Seating", subcategory: "Armchairs", tags: [], image_url: null, hidden_in_trade: true },
      { id: "fao", product_name: "Fao sofa", brand_name: "Collection Particulière", category: "Seating", subcategory: "Sofas", tags: [], image_url: null, hidden_in_trade: true },
    ];
    expect(filterTradeProducts(pieces, { search: "Collection Particulière", category: "Seating" }).map(p => p.id)).toEqual(["pia", "fao"]);
    expect(filterTradeProducts(pieces, { search: "Collection Particulière", category: "Seating", subcategory: "Armchairs" }).map(p => p.id)).toEqual(["pia"]);
    expect(filterTradeProducts(pieces, { category: "Tables" })).toEqual([]);
  });
});