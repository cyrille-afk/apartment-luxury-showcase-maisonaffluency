import { describe, expect, it } from "vitest";
import { priceDifferences, priceValue, durableAttemptRows, startPriceAttempt, finishPriceAttempt, getPriceAttempts, matchesPriceHistoryFilter, priceHistoryCounts, type DurablePriceAttempt } from "./adminPriceHistory";
describe("admin price history", () => {
  it("records previous and new main prices in cents", () => {
    expect(priceDifferences({ trade_price_cents: 399000 }, { trade_price_cents: 499000 })).toEqual([{ label: "Main price", before: 399000, after: 499000 }]);
  });
  it("records changed finish prices without treating reordering as price changes", () => {
    const dark = { base: "Dark Solid Oak", price_cents: 499000 };
    expect(priceDifferences({ size_variants: [dark, { base: "Light Solid Oak", price_cents: 0 }] }, { size_variants: [{ base: "Light Solid Oak", price_cents: 499000 }, dark] })).toEqual([{ label: "Light Solid Oak", before: 0, after: 499000 }]);
  });
  it("does not mistake photo edits for price changes", () => {
    expect(priceDifferences({ size_variants: [{ base: "Oak", price_cents: 499000, image_index: 0 }] }, { size_variants: [{ base: "Oak", price_cents: 499000, image_index: 2 }] })).toEqual([]);
  });
  it("does not report new unpriced options as price changes", () => {
    expect(priceDifferences({ size_variants: [] }, { size_variants: [{ base: "Travertine", price_cents: 0 }] })).toEqual([]);
  });
  it("marks failed saves without inventing saved records", () => {
    const id = startPriceAttempt({ userId: "admin", product: "Chair", currency: "EUR", changes: [{ label: "Main price", before: 399000, after: 499000 }] });
    expect(getPriceAttempts().find((row) => row.id === id)?.status).toBe("Saving");
    finishPriceAttempt(id, "Failed");
    expect(getPriceAttempts().find((row) => row.id === id)?.status).toBe("Failed");
    finishPriceAttempt(id, "Saved");
    expect(getPriceAttempts().find((row) => row.id === id)).toBeUndefined();
  });
  it("does not render missing prices as free", () => { expect(priceValue(0, "EUR")).toBe("Price upon Request"); });
  const durable: DurablePriceAttempt = { id: "persisted", user_id: "admin", product_name: "Chair", created_at: "2026-10-28T02:13:00Z", completed_at: "2026-10-28T02:13:01Z", status: "Failed", old_data: { currency: "EUR", trade_price_cents: 399000 }, new_data: { currency: "EUR", trade_price_cents: 499000 } };
  it("restores failed values and server timestamps without session state", () => {
    expect(durableAttemptRows(JSON.parse(JSON.stringify([durable])))).toEqual([{ id: "persisted", userId: "admin", product: "Chair", currency: "EUR", timestamp: "2026-10-28T02:13:01Z", status: "Failed", changes: [{ label: "Main price", before: 399000, after: 499000 }] }]);
  });
  it("never calls an interrupted save successful", () => { expect(durableAttemptRows([{ ...durable, status: "Saving", completed_at: null }])[0].status).toBe("Unconfirmed"); });
  it("does not duplicate confirmed changes from the authoritative audit log", () => { expect(durableAttemptRows([{ ...durable, status: "Saved" }])).toEqual([]); });
  it("groups save statuses so saved, pending and failed can be viewed apart", () => {
    expect(["Saved", "Failed", "Unconfirmed", "Saving"].map((status) => matchesPriceHistoryFilter(status, "saved"))).toEqual([true, false, false, false]);
    expect(["Saved", "Failed", "Unconfirmed", "Saving"].map((status) => matchesPriceHistoryFilter(status, "pending"))).toEqual([false, false, true, true]);
    expect(["Saved", "Failed", "Unconfirmed", "Saving"].map((status) => matchesPriceHistoryFilter(status, "failed"))).toEqual([false, true, false, false]);
    expect(["Saved", "Failed", "Unconfirmed", "Saving"].map((status) => matchesPriceHistoryFilter(status, "all"))).toEqual([true, true, true, true]);
  });
  it("counts each history row under exactly one status filter", () => {
    const rows = [{ status: "Saved" }, { status: "Saved" }, { status: "Failed" }, { status: "Unconfirmed" }, { status: "Saving" }];
    expect(priceHistoryCounts(rows)).toEqual({ all: 5, saved: 2, pending: 2, failed: 1 });
  });
});