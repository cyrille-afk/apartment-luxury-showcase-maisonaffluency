import { useEffect, useState } from "react";
import { useTradeOfficeMarket, type TradeOfficeMarket } from "@/hooks/useTradeOfficeMarket";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import type { DisplayCurrency } from "@/components/trade/CurrencyToggle";

export const REGIONAL_TIERS = {
  EUR: { currencySymbol: "€", label: "EUR", gold: 150000, platinum: 300000, examples: [48000, 152000, 100000] },
  USD: { currencySymbol: "$", label: "USD", gold: 165000, platinum: 330000, examples: [50000, 165000, 115000] },
  SGD: { currencySymbol: "S$", label: "SGD", gold: 220000, platinum: 440000, examples: [65000, 220000, 155000] },
} as const;
type TierCurrency = keyof typeof REGIONAL_TIERS;

export function tierVolumeCurrency(market: TradeOfficeMarket, preferred: DisplayCurrency): TierCurrency {
  if (market === "US") return "USD";
  if (market === "SG") return "SGD";
  if (preferred === "USD" || preferred === "SGD") return preferred;
  return "EUR";
}

export function tierVolumeModel(currency: TierCurrency) {
  const region = REGIONAL_TIERS[currency];
  // Confirmed spend remains in EUR cents on the server; this fixed fiscal-year
  // display ratio is not an exchange rate or an eligibility calculation.
  const amount = (eurCents: number) => Math.round(eurCents / 100 * region.gold / REGIONAL_TIERS.EUR.gold);
  const format = (value: number) => `${region.currencySymbol}${value.toLocaleString("en-US")}`;
  return { currency, amount, format, gold: region.gold, platinum: region.platinum, examples: region.examples };
}

export type TierVolumeModel = ReturnType<typeof tierVolumeModel>;

export function useTierVolumeLocale() {
  const market = useTradeOfficeMarket();
  const [preferred] = useTradeDisplayCurrency();
  const [usIp, setUsIp] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Use the same consent-gated country cache as the trade currency selector.
    // A US visitor takes the native US baseline even when their saved display
    // currency was chosen on a previous visit elsewhere.
    try {
      if (localStorage.getItem("cookie_consent") !== "accepted" || market) return;
      const cached = localStorage.getItem("trade.detectedCountry");
      const age = Date.now() - Number(localStorage.getItem("trade.detectedCountry.ts") || 0);
      if (cached && age >= 0 && age < 30 * 24 * 60 * 60 * 1000) {
        setUsIp(cached.toUpperCase() === "US");
        return;
      }
    } catch { return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled && data) setUsIp((data.country_code || data.country || "").toUpperCase() === "US");
      }).catch(() => undefined).finally(() => window.clearTimeout(timeout));
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timeout); };
  }, [market]);
  const currency = tierVolumeCurrency(usIp ? "US" : market, preferred);
  return { ...tierVolumeModel(currency), market };
}