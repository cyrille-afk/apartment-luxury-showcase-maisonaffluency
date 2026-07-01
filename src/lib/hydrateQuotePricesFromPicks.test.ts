import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client before importing the module under test.
const inMock = vi.fn();
const selectMock = vi.fn(() => ({ in: inMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (name: string) => fromMock(name) },
}));

import { hydrateQuotePricesFromPicks } from "./hydrateQuotePricesFromPicks";

type Item = {
  id: string;
  product: {
    source_pick_id: string | null;
    trade_price_cents: number | null;
    currency: string | null;
  } | null;
};

function mockPicks(rows: Array<{ id: string; trade_price_cents: number | null; currency: string | null }>) {
  inMock.mockResolvedValueOnce({ data: rows, error: null });
}

beforeEach(() => {
  fromMock.mockClear();
  selectMock.mockClear();
  inMock.mockReset();
});

describe("hydrateQuotePricesFromPicks", () => {
  it("returns early when there are no items", async () => {
    const result = await hydrateQuotePricesFromPicks<"product", Item>([], "product");
    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("skips fetching when no items carry a source_pick_id", async () => {
    const items: Item[] = [
      { id: "a", product: { source_pick_id: null, trade_price_cents: 100, currency: "EUR" } },
      { id: "b", product: null },
    ];
    const result = await hydrateQuotePricesFromPicks(items, "product");
    expect(result).toBe(items);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("hydrates from picks when the trade_products mirror row is missing (null price)", async () => {
    mockPicks([{ id: "pick-1", trade_price_cents: 450000, currency: "EUR" }]);
    const items: Item[] = [
      { id: "q1", product: { source_pick_id: "pick-1", trade_price_cents: null, currency: null } },
    ];
    const result = await hydrateQuotePricesFromPicks(items, "product");
    expect(result[0].product?.trade_price_cents).toBe(450000);
    expect(result[0].product?.currency).toBe("EUR");
    expect(fromMock).toHaveBeenCalledWith("designer_curator_picks");
    expect(inMock).toHaveBeenCalledWith("id", ["pick-1"]);
  });

  it("overrides stale trade_products price with the pick price (source of truth)", async () => {
    mockPicks([{ id: "pick-2", trade_price_cents: 900000, currency: "USD" }]);
    const items: Item[] = [
      { id: "q1", product: { source_pick_id: "pick-2", trade_price_cents: 500000, currency: "EUR" } },
    ];
    const result = await hydrateQuotePricesFromPicks(items, "product");
    expect(result[0].product?.trade_price_cents).toBe(900000);
    expect(result[0].product?.currency).toBe("USD");
  });

  it("leaves the item alone when the pick has no price", async () => {
    mockPicks([{ id: "pick-3", trade_price_cents: null, currency: "EUR" }]);
    const items: Item[] = [
      { id: "q1", product: { source_pick_id: "pick-3", trade_price_cents: 250000, currency: "EUR" } },
    ];
    const result = await hydrateQuotePricesFromPicks(items, "product");
    expect(result[0].product?.trade_price_cents).toBe(250000);
    expect(result[0].product?.currency).toBe("EUR");
  });

  it("preserves the existing currency when the pick's currency is null", async () => {
    mockPicks([{ id: "pick-4", trade_price_cents: 120000, currency: null }]);
    const items: Item[] = [
      { id: "q1", product: { source_pick_id: "pick-4", trade_price_cents: null, currency: "GBP" } },
    ];
    const result = await hydrateQuotePricesFromPicks(items, "product");
    expect(result[0].product?.trade_price_cents).toBe(120000);
    expect(result[0].product?.currency).toBe("GBP");
  });

  it("defaults currency to EUR when both pick and product currency are missing", async () => {
    mockPicks([{ id: "pick-5", trade_price_cents: 80000, currency: null }]);
    const items: Item[] = [
      { id: "q1", product: { source_pick_id: "pick-5", trade_price_cents: null, currency: null } },
    ];
    const result = await hydrateQuotePricesFromPicks(items, "product");
    expect(result[0].product?.currency).toBe("EUR");
  });

  it("deduplicates pick ids in the fetch and hydrates all matching lines", async () => {
    mockPicks([
      { id: "pick-A", trade_price_cents: 111000, currency: "EUR" },
      { id: "pick-B", trade_price_cents: 222000, currency: "EUR" },
    ]);
    const items: Item[] = [
      { id: "q1", product: { source_pick_id: "pick-A", trade_price_cents: null, currency: null } },
      { id: "q2", product: { source_pick_id: "pick-A", trade_price_cents: null, currency: null } },
      { id: "q3", product: { source_pick_id: "pick-B", trade_price_cents: 999999, currency: "EUR" } },
    ];
    const result = await hydrateQuotePricesFromPicks(items, "product");
    expect(inMock).toHaveBeenCalledWith("id", ["pick-A", "pick-B"]);
    expect(result[0].product?.trade_price_cents).toBe(111000);
    expect(result[1].product?.trade_price_cents).toBe(111000);
    expect(result[2].product?.trade_price_cents).toBe(222000);
  });

  it("returns items untouched when the supabase query errors", async () => {
    inMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const items: Item[] = [
      { id: "q1", product: { source_pick_id: "pick-x", trade_price_cents: 100, currency: "EUR" } },
    ];
    const result = await hydrateQuotePricesFromPicks(items, "product");
    expect(result[0].product?.trade_price_cents).toBe(100);
  });

  it("does not mutate the original items array", async () => {
    mockPicks([{ id: "pick-z", trade_price_cents: 700000, currency: "EUR" }]);
    const original: Item[] = [
      { id: "q1", product: { source_pick_id: "pick-z", trade_price_cents: null, currency: null } },
    ];
    const snapshot = JSON.parse(JSON.stringify(original));
    await hydrateQuotePricesFromPicks(original, "product");
    expect(original).toEqual(snapshot);
  });
});
