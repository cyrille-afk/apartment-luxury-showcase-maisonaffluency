import { describe, expect, it, vi } from "vitest";
vi.mock("./fxRates", () => ({ getFxRate: vi.fn(async (source: string) => source === "USD" ? 0.9 : 1) }));
import { moodRetailEur, moodCataloguePrice } from "./moodBoardDetails";

describe("Mood Board supplier RRPs", () => {
  it("uses Rift CTS's €29,202 starting size price when the base field is empty", () => {
    expect(moodCataloguePrice(null, [{ price_cents: 2920200 }, { price_cents: 3329300 }, { price_cents: 3946000 }])).toEqual({ cents: 2920200, from: true });
  });
  it("also resolves Rift CTW's €17,944 starting price", () => {
    expect(moodCataloguePrice(null, [{ price_cents: 1943400 }, { price_cents: 1794400 }])).toEqual({ cents: 1794400, from: true });
  });
  it("preserves a recorded base price and ignores unpriced variants", () => {
    expect(moodCataloguePrice(479100, [{ price_cents: 100 }])).toEqual({ cents: 479100, from: false });
    expect(moodCataloguePrice(null, [{ price_cents: 0 }, { price_cents: null }])).toEqual({ cents: null, from: false });
  });
  it("converts Lamont Otto's $2,554 RRP to the EUR budget ledger", async () => {
    expect(await moodRetailEur(255400, "USD")).toBe(229860);
  });
  it("keeps EUR RRPs unchanged", async () => {
    expect(await moodRetailEur(479100, "EUR")).toBe(479100);
  });
  it("leaves genuinely missing prices unconfirmed", async () => {
    expect(await moodRetailEur(null, "USD")).toBeNull();
    expect(await moodRetailEur(0, "USD")).toBeNull();
  });
});