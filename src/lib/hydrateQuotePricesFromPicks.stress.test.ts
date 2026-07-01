import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client before importing the module under test.
const inMock = vi.fn();
const selectMock = vi.fn(() => ({ in: inMock }));
const fromMock = vi.fn((_name: string) => ({ select: selectMock }));

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

beforeEach(() => {
  fromMock.mockClear();
  selectMock.mockClear();
  inMock.mockReset();
});

/**
 * Stress-tests the batch-fetch behaviour of hydrateQuotePricesFromPicks.
 *
 * Real-world worst-case: a project-wide quote pulling ~50 designers × 20
 * picks each (1000 lines), with duplicate picks repeated across rooms.
 * The helper must:
 *   1. Issue exactly ONE round-trip to Supabase (not per line, not per designer).
 *   2. Deduplicate pick ids in the `.in()` payload so we don't blow up URL size.
 *   3. Hydrate every matching line correctly, even when some picks are
 *      missing or have NULL prices (mixed regime).
 *   4. Complete in well under a second for a 1000-line quote in-memory.
 */
describe("hydrateQuotePricesFromPicks — stress / performance", () => {
  it("handles a 1000-line quote across 500 unique picks with a single batched query", async () => {
    const DESIGNERS = 50;
    const PICKS_PER_DESIGNER = 10;
    const LINES_PER_PICK = 2; // same pick repeated across two rooms
    const totalPicks = DESIGNERS * PICKS_PER_DESIGNER; // 500
    const totalLines = totalPicks * LINES_PER_PICK; // 1000

    const items: Item[] = [];
    for (let d = 0; d < DESIGNERS; d++) {
      for (let p = 0; p < PICKS_PER_DESIGNER; p++) {
        const pickId = `d${d}-p${p}`;
        for (let l = 0; l < LINES_PER_PICK; l++) {
          items.push({
            id: `line-${items.length}`,
            product: {
              source_pick_id: pickId,
              // Simulate a stale mirror: every line comes in with a wrong price
              // that must be overwritten by the pick fetch.
              trade_price_cents: 1,
              currency: "EUR",
            },
          });
        }
      }
    }
    expect(items).toHaveLength(totalLines);

    // Server-side response: every pick priced deterministically so we can
    // verify per-line correctness after hydration.
    const priceFor = (pickId: string) => pickId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 100;
    inMock.mockImplementationOnce(async (_col: string, ids: string[]) => ({
      data: ids.map((id) => ({ id, trade_price_cents: priceFor(id), currency: "EUR" })),
      error: null,
    }));

    const t0 = performance.now();
    const result = await hydrateQuotePricesFromPicks(items, "product");
    const elapsed = performance.now() - t0;

    // 1. Exactly ONE query issued.
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("designer_curator_picks");
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(inMock).toHaveBeenCalledTimes(1);

    // 2. `.in()` payload contains the deduplicated set of pick ids only.
    const [, idsArg] = inMock.mock.calls[0] as [string, string[]];
    expect(idsArg).toHaveLength(totalPicks);
    expect(new Set(idsArg).size).toBe(totalPicks);

    // 3. Every line hydrated to its pick's price. Sample-check a few and
    //    then verify the full set to catch any drift.
    expect(result).toHaveLength(totalLines);
    for (const line of result) {
      const pickId = line.product!.source_pick_id!;
      expect(line.product!.trade_price_cents).toBe(priceFor(pickId));
      expect(line.product!.currency).toBe("EUR");
    }

    // 4. Perf ceiling: 1000 lines through the pure JS pipeline should be
    //    trivial. 500ms is generous headroom for CI variance.
    expect(elapsed).toBeLessThan(500);
  });

  it("still issues a single query and preserves order under a mixed regime (missing / null / drifted picks)", async () => {
    const PICK_COUNT = 300;
    const items: Item[] = [];
    for (let i = 0; i < PICK_COUNT; i++) {
      items.push({
        id: `line-${i}`,
        product: {
          source_pick_id: `pick-${i}`,
          trade_price_cents: 1000, // stale placeholder
          currency: "EUR",
        },
      });
    }
    // Sprinkle in lines without a pick — must be passed through untouched
    // and must not appear in the fetch payload.
    items.push({ id: "manual-1", product: { source_pick_id: null, trade_price_cents: 42, currency: "USD" } });
    items.push({ id: "manual-2", product: null });

    inMock.mockImplementationOnce(async (_col: string, ids: string[]) => ({
      data: ids.map((id, idx) => {
        // Three regimes: priced, null price, missing from response entirely.
        if (idx % 3 === 0) return { id, trade_price_cents: 50000 + idx, currency: "EUR" };
        if (idx % 3 === 1) return { id, trade_price_cents: null, currency: "EUR" };
        return null;
      }).filter(Boolean),
      error: null,
    }));

    const result = await hydrateQuotePricesFromPicks(items, "product");

    // Single batched query, and no null/manual pick leaked into the ids.
    expect(inMock).toHaveBeenCalledTimes(1);
    const [, idsArg] = inMock.mock.calls[0] as [string, string[]];
    expect(idsArg).toHaveLength(PICK_COUNT);
    expect(idsArg).not.toContain(null);

    // Order preserved — index i maps back to the same line.
    for (let i = 0; i < PICK_COUNT; i++) {
      const line = result[i];
      expect(line.id).toBe(`line-${i}`);
      if (i % 3 === 0) {
        // priced → overwritten
        expect(line.product!.trade_price_cents).toBe(50000 + i);
      } else {
        // null price or missing → left alone at the stale placeholder
        expect(line.product!.trade_price_cents).toBe(1000);
      }
    }

    // Manual lines untouched.
    expect(result[PICK_COUNT].product!.trade_price_cents).toBe(42);
    expect(result[PICK_COUNT + 1].product).toBeNull();
  });
});
