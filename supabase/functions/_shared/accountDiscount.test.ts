import { describe, expect, it } from "vitest";
import { resolveAccountDiscount } from "./accountDiscount";

function mockDb(tierCfg: any) {
  return {
    from(table: string) {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          if (table === "profiles") return { data: { trade_tier: "silver", trade_status: "approved" } };
          return { data: tierCfg };
        },
        then: (r: any) => r({ data: table === "user_roles" ? [{ role: "trade_user" }] : [] }),
      };
      return q;
    },
  };
}

describe("resolveAccountDiscount", () => {
  it("uses the configured tier rate", async () => {
    const r = await resolveAccountDiscount(mockDb({ tier: "silver", discount_pct: 0.1, label: "Silver" }), "u1");
    expect(r.pct).toBe(0.1);
  });
  it("charges full price when tier settings can't be loaded", async () => {
    const r = await resolveAccountDiscount(mockDb(null), "u1");
    expect(r).toEqual({ pct: 0, label: null });
  });
});
