import { describe, expect, it } from "vitest";
import { resolveAccountDiscount } from "./accountDiscount";

function mockDb(tierCfg: any, roles = ["trade_user"], roleError: unknown = null) {
  return {
    from(table: string) {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          if (table === "profiles") return { data: { trade_tier: "silver", trade_status: "approved" } };
          return { data: tierCfg };
        },
        then: (r: any) => r({ data: table === "user_roles" ? roles.map(role => ({ role })) : [], error: roleError }),
      };
      return q;
    },
  };
}

describe("resolveAccountDiscount", () => {
  it("never grants a confirmed public customer Trade discounts without a Trade role", async () => {
    const r = await resolveAccountDiscount(mockDb({ tier: "silver", discount_pct: 0.1, label: "Silver" }, []), "customer");
    expect(r).toEqual({ pct: 0, label: null });
  });
  it("keeps administrator pricing independent of Trade membership", async () => {
    const r = await resolveAccountDiscount(mockDb({ tier: "silver", discount_pct: 0.1, label: "Silver" }, ["admin"]), "admin");
    expect(r).toEqual({ pct: 0.1, label: "Administrator Discount (10%)" });
  });
  it("fails closed when role validation fails", async () => {
    const r = await resolveAccountDiscount(mockDb({ tier: "silver", discount_pct: 0.1, label: "Silver" }, ["trade_user"], { message: "unavailable" }), "member");
    expect(r).toEqual({ pct: 0, label: null });
  });
  it("uses the configured tier rate", async () => {
    const r = await resolveAccountDiscount(mockDb({ tier: "silver", discount_pct: 0.1, label: "Silver" }), "u1");
    expect(r.pct).toBe(0.1);
  });
  it("charges full price when tier settings can't be loaded", async () => {
    const r = await resolveAccountDiscount(mockDb(null), "u1");
    expect(r).toEqual({ pct: 0, label: null });
  });
});
