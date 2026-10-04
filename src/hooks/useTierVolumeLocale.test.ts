import { describe, expect, it } from "vitest";
import { REGIONAL_TIERS, tierVolumeCurrency, tierVolumeModel } from "./useTierVolumeLocale";

describe("localized tier volume presentation", () => {
  it("gives the US branch native USD milestones even with another saved preference", () => {
    expect(tierVolumeCurrency("US", "EUR")).toBe("USD");
    const us = tierVolumeModel("USD");
    expect([us.gold, us.platinum, us.examples]).toEqual([165000, 330000, [50000, 165000, 115000]]);
    expect(us.examples.reduce((sum, n) => sum + n, 0)).toBe(us.platinum);
    expect(us.format(us.gold)).toBe("$165,000");
    expect(us.amount(0)).toBe(0);
  });

  it("restores the EUR baseline and keeps Singapore thresholds and examples in SGD", () => {
    expect(tierVolumeCurrency(null, "EUR")).toBe("EUR");
    expect(tierVolumeCurrency("SG", "original")).toBe("SGD");
    expect(tierVolumeCurrency(null, "USD")).toBe("USD");
    const eu = tierVolumeModel("EUR");
    expect([eu.gold, eu.platinum, eu.examples]).toEqual([150000, 300000, [48000, 152000, 100000]]);
    const sg = tierVolumeModel("SGD");
    expect([sg.gold, sg.platinum, sg.examples]).toEqual([220000, 440000, [65000, 220000, 155000]]);
    expect(sg.format(sg.gold)).toBe("S$220,000");
    expect(tierVolumeCurrency(null, "GBP")).toBe("EUR");
    for (const currency of Object.keys(REGIONAL_TIERS) as (keyof typeof REGIONAL_TIERS)[]) {
      const model = tierVolumeModel(currency);
      expect(model.examples.reduce((sum, n) => sum + n, 0)).toBe(model.platinum);
      expect(model.amount(15000000)).toBe(model.gold);
      expect(model.amount(30000000)).toBe(model.platinum);
    }
  });
});