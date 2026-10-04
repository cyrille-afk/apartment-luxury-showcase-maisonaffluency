import { useEffect, useState } from "react";
import { getFxRate, FALLBACK_RATES } from "@/lib/fxRates";
import { useTradeOfficeMarket, type TradeOfficeMarket } from "@/hooks/useTradeOfficeMarket";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import type { DisplayCurrency } from "@/components/trade/CurrencyToggle";
import type { TradeTier, TierConfigRow } from "@/hooks/useTradeDiscount";

type TierConfig = Record<TradeTier, TierConfigRow>;
type TierCurrency = Exclude<DisplayCurrency, "original">;

export function tierVolumeCurrency(market: TradeOfficeMarket, preferred: DisplayCurrency): TierCurrency {
  // The US branch's tier milestones are a fixed native USD programme.
  if (market === "US") return "USD";
  if (market === "SG") return "SGD";
  if (preferred !== "original") return preferred;
  return market === "GB" ? "GBP" : "EUR";
}

export function tierVolumeModel(config: TierConfig, currency: TierCurrency, fxRate: number) {
  // Tier eligibility remains based on the server's EUR spend ledger. A fixed
  // 1.10 display scale gives the US programme its native $165k/$330k milestones;
  // all other currencies use the same EUR base and one shared FX rate.
  const scale = currency === "USD" ? 1.1 : currency === "EUR" ? 1 : fxRate;
  const amount = (eurCents: number) => Math.round(eurCents / 100 * scale);
  const format = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(value);
  const gold = amount(config.gold.min_spend_cents);
  const platinum = amount(config.platinum.min_spend_cents);
  // The worked examples are matched to the native US milestones, not rounded
  // from EUR independently (53 + 167 + 110 = 330).
  const base = currency === "USD" ? [53000, 167000] : [48000, 152000];
  const reference = currency === "USD" ? 330000 : 300000;
  const examples = [Math.round(platinum * base[0] / reference), Math.round(platinum * base[1] / reference)];
  examples.push(platinum - examples[0] - examples[1]);
  return { currency, amount, format, gold, platinum, examples };
}

export function useTierVolumeLocale(config: TierConfig) {
  const market = useTradeOfficeMarket();
  const [preferred] = useTradeDisplayCurrency();
  const [usIp, setUsIp] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Use the same consent-gated country cache as the trade currency selector.
    // A US visitor takes the native US baseline even when their saved display
    // currency was chosen on a previous visit elsewhere.
    try {
      if (localStorage.getItem("cookie_consent") !== "accepted" || market === "SG" || market === "GB") return;
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
  const [fx, setFx] = useState<{ currency: TierCurrency; rate: number } | null>(null);

  useEffect(() => {
    if (currency === "EUR" || currency === "USD") return;
    let cancelled = false;
    getFxRate("EUR", currency).then((rate) => {
      if (!cancelled && Number.isFinite(rate) && rate > 0) setFx({ currency, rate });
    });
    return () => { cancelled = true; };
  }, [currency]);

  const rate = currency === "EUR" ? 1 : currency === "USD" ? 1.1
    : fx?.currency === currency ? fx.rate : FALLBACK_RATES[`EUR_${currency}`] ?? 1;
  return { ...tierVolumeModel(config, currency, rate), market };
}