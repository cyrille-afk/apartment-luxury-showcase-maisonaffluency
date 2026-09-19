import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unsupported shipping-lane fallback coverage.
 *
 * The estimator must never answer "contact us" for a European maker when the
 * French consolidation hub has a published lane — it prices the hub lane and
 * flags the result as indicative, with a 12% inland transfer uplift.
 */

type Rows = Record<string, unknown[]>;
let rows: Rows = {};
const laneFilters: Array<Record<string, unknown>> = [];

function builder(table: string) {
  const filters: Record<string, unknown> = {};
  const chain: Record<string, unknown> = {};
  const add = (k: string) => {
    chain[k] = (col: string, val?: unknown) => {
      filters[`${k}:${col}`] = val;
      return chain;
    };
  };
  ["select", "eq", "in", "lte", "gte", "limit"].forEach(add);
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => {
    if (table === "shipping_lanes") laneFilters.push({ ...filters });
    const data =
      table === "shipping_lanes"
        ? (rows.shipping_lanes || []).filter(
            (l) => (l as { origin_country: string }).origin_country === filters["eq:origin_country"],
          )
        : rows[table] || [];
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => builder(table) },
}));

const { estimateShipping } = await import("./shippingEstimator");

const hubLane = {
  id: "lane-fr-gb",
  origin_country: "FR",
  dest_country: "GB",
  mode: "road",
  carrier_name: "Test Forwarder",
  transit_days_min: 4,
  transit_days_max: 7,
  active: true,
};

const bracket = {
  lane_id: "lane-fr-gb",
  min_volume_cbm: 0,
  max_volume_cbm: 100,
  min_weight_kg: 0,
  max_weight_kg: 10_000,
  base_rate_cents: 50_000,
  rate_per_cbm_cents: 10_000,
  rate_per_kg_cents: 0,
  min_charge_cents: 0,
  valid_from: "2000-01-01",
  valid_to: null,
};

beforeEach(() => {
  laneFilters.length = 0;
  rows = {
    shipping_lanes: [hubLane],
    shipping_rate_brackets: [bracket],
    shipping_surcharges: [],
    shipping_duty_rates: [],
  };
});

const input = {
  origin_country: "IT",
  dest_country: "GB",
  total_volume_cbm: 5,
  total_weight_kg: 400,
  declared_value_cents: 5_000_000,
  currency: "GBP",
};

describe("unsupported lane fallback", () => {
  it("prices an Italian maker via the French consolidation hub", async () => {
    const r = await estimateShipping(input);
    expect(r.available).toBe(true);
    expect(r.is_indicative).toBe(true);
    expect(r.proxy_origin).toBe("FR");
    expect(r.selected_lane_id).toBe("lane-fr-gb");
    // 50,000 + 10,000 × 5 = 100,000, +12% inland transfer uplift.
    expect(r.freight_cents).toBe(112_000);
    expect(r.reason).toMatch(/indicative/i);
    // It tried the direct lane before falling back to the hub.
    expect(laneFilters.map((f) => f["eq:origin_country"])).toEqual(["IT", "FR"]);
  });

  it("does not apply the uplift when a direct lane exists", async () => {
    rows.shipping_lanes = [{ ...hubLane, origin_country: "IT", id: "lane-fr-gb" }];
    const r = await estimateShipping(input);
    expect(r.is_indicative).toBe(false);
    expect(r.proxy_origin).toBeNull();
    expect(r.freight_cents).toBe(100_000);
  });

  it("returns a manual-quote message when no hub lane exists either", async () => {
    rows.shipping_lanes = [];
    const r = await estimateShipping(input);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/manual quote/i);
  });

  it("refuses to fabricate a rate without weight or dimensions", async () => {
    const r = await estimateShipping({ ...input, total_volume_cbm: 0, total_weight_kg: 0 });
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/not on file/i);
  });
});
