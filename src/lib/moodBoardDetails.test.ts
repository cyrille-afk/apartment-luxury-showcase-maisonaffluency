import { describe, expect, it, vi } from "vitest";
vi.mock("./fxRates", () => ({ getFxRate: vi.fn(async (source: string) => source === "USD" ? 0.9 : 1) }));
import { moodRetailEur } from "./moodBoardDetails";

describe("Mood Board supplier RRPs", () => {
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