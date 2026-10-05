import { describe, expect, it } from "vitest";
import { calculateCeilingBudget } from "@/lib/ceilingBudget";

describe("calculateCeilingBudget", () => {
  it("calculates the approved top-down formula in integer cents", () => {
    const result = calculateCeilingBudget({
      targetCeilingCents: 5_000_000,
      clientMarkupPct: 15,
      tradeDiscountPct: 12,
      tierLabel: "Gold",
    });

    expect(result.maxDesignerCostCents).toBe(4_347_826);
    expect(result.designerNetProfitCents).toBe(652_174);
    expect(result.tradeSourcingMarkdownCents).toBe(521_739);
    expect(result.netPurchasingBudgetCents).toBe(3_826_087);
    expect(result.designerNetProfitCents + result.maxDesignerCostCents).toBe(5_000_000);
    expect(result.tradeSourcingMarkdownCents + result.netPurchasingBudgetCents).toBe(4_347_826);
  });
});