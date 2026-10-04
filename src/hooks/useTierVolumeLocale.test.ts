import { describe, expect, it } from "vitest";
import { tierVolumeCurrency, tierVolumeModel } from "./useTierVolumeLocale";
import type { TradeTier, TierConfigRow } from "./useTradeDiscount";

const config = Object.fromEntries([
  ["silver", 0], ["gold", 15000000], ["platinum", 30000000],
].map(([tier, cents]) => [tier, { tier, min_spend_cents: cents, discount_pct: 0, label: tier }])) as Record<TradeTier, TierConfigRow>;

describe("localized tier volume presentation", () => {
  it("gives the US branch native USD milestones even with another saved preference", () => {
    expect(tierVolumeCurrency("US", "EUR")).toBe("USD");
    const us = tierVolumeModel(config, "USD", 1.473);
    expect([us.gold, us.platinum, us.examples]).toEqual([165000, 330000, [53000, 167000, 110000]]);
    expect(us.examples.reduce((sum, n) => sum + n, 0)).toBe(us.platinum);
    expect(us.format(us.gold)).toBe("$165,000");
    expect(us.amount(0)).toBe(0);
  });

  it("restores the EUR baseline and keeps Singapore thresholds and examples in SGD", () => {
    expect(tierVolumeCurrency(null, "EUR")).toBe("EUR");
    expect(tierVolumeCurrency("SG", "original")).toBe("SGD");
    expect(tierVolumeCurrency(null, "USD")).toBe("USD");
    const eu = tierVolumeModel(config, "EUR", 1.473);
    expect([eu.gold, eu.platinum, eu.examples]).toEqual([150000, 300000, [48000, 152000, 100000]]);
    const sg = tierVolumeModel(config, "SGD", 1.473);
    expect([sg.gold, sg.platinum]).toEqual([220950, 441900]);
    expect(sg.examples.reduce((sum, n) => sum + n, 0)).toBe(sg.platinum);
    expect(sg.format(sg.gold)).toContain("220,950");
  });
});