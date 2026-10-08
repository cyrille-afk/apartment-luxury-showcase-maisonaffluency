import { describe, expect, it } from "vitest";
import { decideVideoAccess } from "../../../supabase/functions/_shared/videoAccess";

const base = { isAdmin: false, tier: "silver" as const, balance: 0, goldMonth: null, goldMonthUsed: 0, month: "2026-10" };

describe("video access tiers", () => {
  it("admin renders free regardless of tier and balance", () => {
    expect(decideVideoAccess({ ...base, isAdmin: true })).toEqual({ allowed: true, consumes: null, reason: "admin" });
  });
  it("platinum renders free with zero balance", () => {
    expect(decideVideoAccess({ ...base, tier: "platinum" })).toEqual({ allowed: true, consumes: null, reason: "platinum" });
  });
  it("silver with 0 credits must purchase", () => {
    expect(decideVideoAccess(base)).toEqual({ allowed: false, reason: "purchase_required" });
  });
  it("silver with a credit uses 1 token", () => {
    expect(decideVideoAccess({ ...base, balance: 1 })).toEqual({ allowed: true, consumes: "token" });
  });
  it("gold gets 1 included render per month", () => {
    expect(decideVideoAccess({ ...base, tier: "gold" })).toEqual({ allowed: true, consumes: "gold_monthly" });
  });
  it("gold after monthly render with 0 credits must purchase", () => {
    expect(decideVideoAccess({ ...base, tier: "gold", goldMonth: "2026-10", goldMonthUsed: 1 })).toEqual({ allowed: false, reason: "purchase_required" });
  });
  it("gold monthly inclusion resets next month", () => {
    expect(decideVideoAccess({ ...base, tier: "gold", goldMonth: "2026-09", goldMonthUsed: 1 })).toEqual({ allowed: true, consumes: "gold_monthly" });
  });
  it("gold after monthly render uses a purchased token", () => {
    expect(decideVideoAccess({ ...base, tier: "gold", goldMonth: "2026-10", goldMonthUsed: 1, balance: 2 })).toEqual({ allowed: true, consumes: "token" });
  });
});
