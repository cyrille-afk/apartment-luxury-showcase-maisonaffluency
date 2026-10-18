import { describe, expect, it } from "vitest";
import { pairingAxisOptions, pairingOptionAvailable, pairingSelectionComplete, pairingSelectionPrice } from "./curatedPairingConfiguration";

const variants = [{ base: "Brass", top: "Glass", label: "Small", price_cents: 120000 }, { base: "Bronze", top: "Stone", label: "Small", price_cents: 180000 }, { base: "Brass", top: "Glass", label: "Large", price_cents: null }];
const row = { rrp_price_cents: 120000, currency: "USD", price_unit: null, price_prefix: null, rrp_size_variants: variants };
describe("recommended piece configuration", () => {
  it("lists each size once independently of finishes", () => expect(pairingAxisOptions(variants, "label")).toEqual(["Small", "Large"]));
  it("blocks incompatible finishes in both directions", () => {
    expect(pairingOptionAvailable(variants, { base: "Brass", top: null, label: "Small" }, "top", "Stone")).toBe(false);
    expect(pairingOptionAvailable(variants, { base: null, top: "Stone", label: "Small" }, "base", "Brass")).toBe(false);
  });
  it("requires all available configuration axes before adding", () => expect(pairingSelectionComplete(variants, { base: "Brass", top: null, label: "Small" })).toBe(false));
  it("uses the selected finish price and quantity, not the cheapest price", () => expect((pairingSelectionPrice(row, { base: "Bronze", top: "Stone", label: "Small" }) || 0) * 3).toBe(540000));
  it("does not substitute base price for an unpriced selection", () => expect(pairingSelectionPrice(row, { base: "Brass", top: "Glass", label: "Large" })).toBeNull());
});