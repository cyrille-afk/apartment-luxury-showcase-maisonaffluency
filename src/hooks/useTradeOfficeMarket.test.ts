import { describe, expect, it } from "vitest";
import { resolveTradeOfficeMarket } from "./useTradeOfficeMarket";

describe("trade office market", () => {
  it("matches registered Singapore, US, and UK accounts", () => {
    expect(resolveTradeOfficeMarket("Singapore")).toBe("SG");
    expect(resolveTradeOfficeMarket("US", "New York")).toBe("US");
    expect(resolveTradeOfficeMarket("United Kingdom", "London")).toBe("GB");
  });

  it("uses city only when account country is absent", () => {
    expect(resolveTradeOfficeMarket(null, "London")).toBe("GB");
    expect(resolveTradeOfficeMarket("Singapore", "New York")).toBe("SG");
    expect(resolveTradeOfficeMarket("France", "London")).toBeNull();
  });
});