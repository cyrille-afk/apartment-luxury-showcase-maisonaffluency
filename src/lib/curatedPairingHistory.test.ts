import { describe, expect, it } from "vitest";
import { pairingHistoryChanges } from "./curatedPairingHistory";

describe("catalog finish and price history", () => {
  const before = { finish_currency: "USD", finish_options: [{ id: "oak", name: "Oak", price_cents: 10000 }] };
  it("records finish edits separately from exact price changes", () => {
    expect(pairingHistoryChanges(before, { ...before, finish_options: [{ id: "oak", name: "Écru Oak", price_cents: 8729 }] })).toEqual([
      { field: "Finish", before: "Oak", after: "Écru Oak" },
      { field: "Écru Oak · retail price", before: "USD 100.00", after: "USD 87.29" },
    ]);
  });
  it("records currency changes even when cents remain unchanged", () => {
    expect(pairingHistoryChanges(before, { ...before, finish_currency: "GBP" })).toContainEqual({ field: "Oak · retail price", before: "USD 100.00", after: "GBP 100.00" });
  });
  it("keeps removed finishes visible in history", () => {
    expect(pairingHistoryChanges(before, { ...before, finish_options: [] })).toContainEqual({ field: "Oak · retail price", before: "USD 100.00", after: "Removed" });
  });
  it("records a change to an unpriced finish without inventing a price", () => {
    expect(pairingHistoryChanges(before, { ...before, finish_options: [{ id: "oak", name: "Oak", price_cents: null }] })).toContainEqual({ field: "Oak · retail price", before: "USD 100.00", after: "Price upon Request" });
  });
  it("does not report unchanged values", () => {
    expect(pairingHistoryChanges(before, before)).toEqual([]);
  });
  it('records product and macro image assignments in history', () => {
    expect(pairingHistoryChanges({}, { finish_media: [{ key: 'custom:oak', label: 'Oak', product_image_url: 'https://assets.example/oak.jpg', macro_image_url: 'https://assets.example/tile.jpg' }] })).toContainEqual({ field: 'Oak · macro texture', before: 'Catalogue fallback', after: 'https://assets.example/tile.jpg' });
  });
});