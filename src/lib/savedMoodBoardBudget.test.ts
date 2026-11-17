import { describe, expect, it } from "vitest";
import { initialSavedMoodBudget, savedMoodBudgetKey } from "./savedMoodBoardBudget";
import { emptyMoodBudget, moodBudgetLedger } from "./moodBoardBudget";

describe("saved folder mood budgets", () => {
  it("restores an exact folder target without overwriting it with the project target", () => {
    const saved = { ...emptyMoodBudget(), totalEur: 500000 };
    expect(initialSavedMoodBudget(saved, null, { target_ceiling_cents: 90000000, ceiling_currency: "USD" })).toEqual(saved);
  });
  it("keeps different folders and accounts isolated", () => {
    expect(savedMoodBudgetKey("owner", "eleven")).not.toBe(savedMoodBudgetKey("owner", "eight"));
    expect(savedMoodBudgetKey("owner", "eleven")).not.toBe(savedMoodBudgetKey("other", "eleven"));
  });
  it("recovers the submitted room target instead of inventing one", () => {
    expect(initialSavedMoodBudget(null, { roomType: "dining", currency: "EUR", targetCents: 50000000 })).toMatchObject({ roomType: "dining", totalEur: 500000 });
    expect(initialSavedMoodBudget(null, null).totalEur).toBeNull();
  });
  it("counts all eleven saved rows, including repeated products, at retail", () => {
    const items = Array.from({ length: 11 }, (_, index) => ({ id: `row-${index}`, product_name: "Chair" }));
    const prices = new Map(items.map(item => [item.id, { retail: 100000, trade: 80000 }]));
    expect(moodBudgetLedger(items, prices, { ...emptyMoodBudget(), totalEur: 20000 })).toMatchObject({ allocated: 1100000, remaining: 900000, unpriced: 0 });
  });
});