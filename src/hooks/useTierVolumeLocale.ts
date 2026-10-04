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

export function tierVolumeCurrency(market: TradeOfficeMarket, preferred: DisplayCurrency, ipMarket: TradeOfficeMarket = null): TierCurrency {
  if (market === "US") return "USD";
  if (market === "SG") return "SGD";
  if (ipMarket === "US") return "USD";
  if (ipMarket === "SG") return "SGD";
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
  const [ipMarket, setIpMarket] = useState<TradeOfficeMarket>(null);
  useEffect(() => {
    let cancelled = false;
    setIpMarket(null);
    // Office location takes precedence; otherwise use the same consent-gated
    // country cache as the trade currency selector for US and SG visitors.
    try {
      if (localStorage.getItem("cookie_consent") !== "accepted" || market === "US" || market === "SG") return;
      const cached = localStorage.getItem("trade.detectedCountry");
      const age = Date.now() - Number(localStorage.getItem("trade.detectedCountry.ts") || 0);
      if (cached && age >= 0 && age < 30 * 24 * 60 * 60 * 1000) {
        setIpMarket(cached.toUpperCase() === "US" ? "US" : cached.toUpperCase() === "SG" ? "SG" : null);
        return;
      }
    } catch { return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled && data) {
          const country = (data.country_code || data.country || "").toUpperCase();
          setIpMarket(country === "US" ? "US" : country === "SG" ? "SG" : null);
        }
      }).catch(() => undefined).finally(() => window.clearTimeout(timeout));
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timeout); };
  }, [market]);
  const currency = tierVolumeCurrency(market, preferred, ipMarket);
  return { ...tierVolumeModel(currency), market };
}