import { describe, expect, it } from "vitest";
import { REGIONAL_TIERS, tierVolumeCurrency, tierVolumeModel } from "./useTierVolumeLocale";
import { resolveTierTokens } from "@/components/trade/FelixTour";
import type { TradeTier, TierConfigRow } from "./useTradeDiscount";

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

  it("resolves every tour volume token from the same regional model as the tier table", () => {
    const cfg = {
      silver: { tier: "silver", discount_pct: 0.10, min_spend_cents: 0, label: "Silver" },
      gold: { tier: "gold", discount_pct: 0.12, min_spend_cents: 15000000, label: "Gold" },
      platinum: { tier: "platinum", discount_pct: 0.15, min_spend_cents: 30000000, label: "Platinum" },
    } as Record<TradeTier, TierConfigRow>;
    for (const [currency, gold, platinum] of [
      ["EUR", "€150,000", "€300,000"],
      ["USD", "$165,000", "$330,000"],
      ["SGD", "S$220,000", "S$440,000"],
    ] as const) {
      const volume = tierVolumeModel(currency);
      expect(resolveTierTokens("toward the {goldVolume} Gold Tier threshold.", cfg, volume))
        .toBe(`toward the ${gold} Gold Tier threshold.`);
      expect(resolveTierTokens("{silverPct} / {goldPct} / {platinumPct} / {platinumVolume}", cfg, volume))
        .toBe(`10% / 12% / 15% / ${platinum}`);
    }
  });
});