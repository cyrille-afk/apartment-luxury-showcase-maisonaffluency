import { describe, expect, it } from "vitest";
import { FELIX_STEP_SIDEBAR, type TourSidebarAnchor } from "./felixTourSidebarMap";

// The 23 onboarding step ids, in tour order (mirrors FELIX_STEPS in FelixTour.tsx).
const STEP_IDS = [
  "welcome", "collection", "quotes", "projects", "tier-tracking",
  "client-safe-presentations", "margin-protection", "quote-generation",
  "direct-client-billing", "tools", "settings", "portfolio-management",
  "bespoke-commissions", "felix-chat", "client-view", "branding-panel",
  "white-label", "invite", "technical-assets", "priority-concierge",
  "ai-extension-sync", "pwa-install", "beta-feedboard",
];

const VALID_ANCHORS: TourSidebarAnchor[] = [
  "dashboard", "collection", "quotes", "projects", "tools",
  "settings", "concierge", "extension-sync", "beta-feedboard", "pwa",
];

describe("global tour step → sidebar map", () => {
  it("maps every one of the 23 onboarding steps to a sidebar item", () => {
    expect(Object.keys(FELIX_STEP_SIDEBAR).sort()).toEqual([...STEP_IDS].sort());
  });
  it("only references sidebar anchors that exist", () => {
    for (const entry of Object.values(FELIX_STEP_SIDEBAR)) {
      expect(VALID_ANCHORS).toContain(entry.anchor);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
  it("keeps both quote steps on the Quotes & Proformas sidebar item", () => {
    expect(FELIX_STEP_SIDEBAR["quote-generation"].anchor).toBe("quotes");
    expect(FELIX_STEP_SIDEBAR["direct-client-billing"].anchor).toBe("quotes");
  });
  it("points the Custom Requests step at Tools, not Projects", () => {
    // The Custom Requests workspace lives under Tools → Custom Requests;
    // sending members to Projects & Interventions was a wrong reference.
    expect(FELIX_STEP_SIDEBAR["bespoke-commissions"].anchor).toBe("tools");
    expect(FELIX_STEP_SIDEBAR["bespoke-commissions"].label).toContain("Custom Requests");
  });
});
