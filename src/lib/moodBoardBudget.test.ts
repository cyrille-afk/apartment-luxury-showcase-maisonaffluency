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
import { convertMoodBudget as _conv, formatMoodMoney as _fmt, moodBudgetLedger as _ledger, emptyMoodBudget as _empty } from "./moodBoardBudget";
describe("mood board currency", () => {
  it("formats with board symbols", () => {
    expect(_fmt(123400, "SGD")).toBe("S$1,234");
    expect(_fmt(100000, "CHF")).toBe("CHF 1,000");
    expect(_fmt(100000, "GBP")).toBe("£1,000");
  });
  it("converts EUR prices into the board currency for remaining budget", () => {
    const s = { ..._empty(), currency: "USD" as const, totalEur: 2000 };
    const l = _ledger([{ id: "a", product_name: "Chair" }], new Map([["a", { retail: 100000, trade: 80000 }]]), s, 1.5);
    expect(l.allocated).toBe(150000);
    expect(l.remaining).toBe(50000);
  });
  it("keeps budget value when switching currency", () => {
    const next = _conv({ ..._empty(), totalEur: 1000, caps: { Seating: 200 } }, "SGD", 1.47);
    expect(next).toMatchObject({ currency: "SGD", totalEur: 1470, caps: { Seating: 294 } });
  });
});
