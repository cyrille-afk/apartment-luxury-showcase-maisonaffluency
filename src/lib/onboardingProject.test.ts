import { describe, expect, it } from "vitest";
import { onboardingProjectForMarket } from "./onboardingProject";

describe("onboarding project localization", () => {
  it("uses the exact folder title and location for each supported market", () => {
    expect(onboardingProjectForMarket("SG")).toEqual({ name: "Singapore GCB workflow", location: "Maison Singapore / Central Area" });
    expect(onboardingProjectForMarket("US")).toEqual({ name: "Tribeca Penthouse Loft", location: "Maison Manhattan / NYC" });
    expect(onboardingProjectForMarket("GB")).toEqual({ name: "Belgravia Townhouse", location: "Maison London / Belgravia" });
  });

  it("does not pretend an unknown region is Singapore", () => {
    expect(onboardingProjectForMarket(null)).toEqual({ name: "Residential Project", location: "Maison Studio" });
  });
});