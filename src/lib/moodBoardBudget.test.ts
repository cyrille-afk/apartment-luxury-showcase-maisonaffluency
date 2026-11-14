import { describe, expect, it } from "vitest";
import { budgetCategory, emptyMoodBudget, fitsMoodBudget, moodBudgetLedger, moodPrices } from "./moodBoardBudget";
describe("Mood Board budget", () => {
  it("tracks EUR allocation and removal at retail, never wholesale", () => {
    const settings = { ...emptyMoodBudget(), totalEur: 10000 };
    const prices = new Map([["sofa", moodPrices(400000, .1)]]);
    expect(moodBudgetLedger([{ id: "sofa", product_name: "Sofa" }], prices, settings)).toMatchObject({ allocated: 400000, remaining: 600000 });
    expect(moodBudgetLedger([], prices, settings).remaining).toBe(1000000);
    expect(prices.get("sofa")?.trade).toBe(360000);
  });
  it("rejects suggestions beyond remaining total", () => {
    const s = { ...emptyMoodBudget(), totalEur: 1000 };
    const ledger = moodBudgetLedger([], new Map(), s);
    expect(fitsMoodBudget({ title: "Lamp" }, moodPrices(100001, 0), ledger, s)).toBe(false);
    expect(fitsMoodBudget({ title: "Lamp" }, moodPrices(100000, 0), ledger, s)).toBe(true);
  });
  it("enforces optional category caps independently", () => {
    const s = { ...emptyMoodBudget(), totalEur: 10000, caps: { Seating: 500 } };
    const ledger = moodBudgetLedger([{ id: "chair", product_name: "Chair" }], new Map([["chair", moodPrices(30000, 0)]]), s);
    expect(fitsMoodBudget({ title: "Sofa" }, moodPrices(20001, 0), ledger, s)).toBe(false);
    expect(fitsMoodBudget({ title: "Side Table" }, moodPrices(80000, 0), ledger, s)).toBe(true);
  });
  it("does not treat unknown prices as affordable", () => {
    const s = { ...emptyMoodBudget(), totalEur: 1000 };
    expect(fitsMoodBudget({ title: "Lamp" }, undefined, moodBudgetLedger([], new Map(), s), s)).toBe(false);
    expect(fitsMoodBudget({ title: "Lamp" }, moodPrices(100, 0), moodBudgetLedger([{ id: "unknown" }], new Map(), s), s)).toBe(false);
  });
  it("assigns each requested budget department by specific typology", () => {
    expect(["Lounge Chair", "Dining Table", "Pendant Light", "Yoma Console", "Wool Rug"].map(product_name => budgetCategory({ product_name })))
      .toEqual(["Seating", "Tables", "Lighting", "Storage", "Rugs/Objects"]);
  });
});