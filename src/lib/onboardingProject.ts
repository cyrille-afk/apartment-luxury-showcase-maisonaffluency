import type { TradeOfficeMarket } from "@/hooks/useTradeOfficeMarket";

/** Stored on starter projects so the label survives sign-in and device changes. */
export const SAMPLE_PROJECT_TAG = "ma:onboarding-sample";
export const CONVERTED_PROJECT_TAG = "ma:onboarding-converted";

const SAMPLE_MARKETS: TradeOfficeMarket[] = ["SG", "US", "GB", null];

export function isSampleProject(project: { name: string; location: string; tags?: string[] | null; client_name?: string | null }) {
  if (project.tags?.includes(CONVERTED_PROJECT_TAG)) return false;
  if (project.tags?.includes(SAMPLE_PROJECT_TAG)) return true;
  // Starters created before the marker was introduced have these exact template values.
  return (!project.client_name || project.client_name === "Sample Client") &&
    SAMPLE_MARKETS.some((market) => {
      const template = onboardingProjectForMarket(market);
      return project.name === template.name && project.location === template.location;
    });
}

/** Copy for the real starter folder; unknown markets remain region-neutral. */
export function onboardingProjectForMarket(market: TradeOfficeMarket) {
  switch (market) {
    case "SG": return { name: "Singapore GCB workflow", location: "Maison Singapore / Central Area" };
    case "US": return { name: "Tribeca Penthouse Loft", location: "Maison Manhattan / NYC" };
    case "GB": return { name: "Belgravia Townhouse", location: "Maison London / Belgravia" };
    default: return { name: "Residential Project", location: "Maison Studio" };
  }
}