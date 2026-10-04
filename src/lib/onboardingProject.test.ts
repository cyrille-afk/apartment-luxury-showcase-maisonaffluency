import { describe, expect, it } from "vitest";
import { onboardingProjectForMarket, isSampleProject, SAMPLE_PROJECT_TAG, CONVERTED_PROJECT_TAG } from "./onboardingProject";

describe("onboarding project localization", () => {
  it("uses the exact folder title and location for each supported market", () => {
    expect(onboardingProjectForMarket("SG")).toEqual({ name: "Singapore GCB workflow", location: "Maison Singapore / Central Area" });
    expect(onboardingProjectForMarket("US")).toEqual({ name: "Tribeca Penthouse Loft", location: "Maison Manhattan / NYC" });
    expect(onboardingProjectForMarket("GB")).toEqual({ name: "Belgravia Townhouse", location: "Maison London / Belgravia" });
  });

  it("does not pretend an unknown region is Singapore", () => {
    expect(onboardingProjectForMarket(null)).toEqual({ name: "Residential Project", location: "Maison Studio" });
  });

  it("identifies marked and legacy starters without labelling renamed real projects", () => {
    expect(isSampleProject({ name: "Custom", location: "NYC", tags: [SAMPLE_PROJECT_TAG] })).toBe(true);
    expect(isSampleProject({ name: "Singapore GCB workflow", location: "Maison Singapore / Central Area", tags: [] })).toBe(true);
    expect(isSampleProject({ name: "Singapore GCB workflow", location: "My client site", tags: [] })).toBe(false);
    expect(isSampleProject({ name: "Singapore GCB workflow", location: "Maison Singapore / Central Area", client_name: "Real client" })).toBe(false);
    expect(isSampleProject({ name: "Singapore GCB workflow", location: "Maison Singapore / Central Area", tags: [CONVERTED_PROJECT_TAG] })).toBe(false);
  });
});