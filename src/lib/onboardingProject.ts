import type { TradeOfficeMarket } from "@/hooks/useTradeOfficeMarket";

/** Copy for the real starter folder; unknown markets remain region-neutral. */
export function onboardingProjectForMarket(market: TradeOfficeMarket) {
  switch (market) {
    case "SG": return { name: "Singapore GCB workflow", location: "Maison Singapore / Central Area" };
    case "US": return { name: "Tribeca Penthouse Loft", location: "Maison Manhattan / NYC" };
    case "GB": return { name: "Belgravia Townhouse", location: "Maison London / Belgravia" };
    default: return { name: "Residential Project", location: "Maison Studio" };
  }
}