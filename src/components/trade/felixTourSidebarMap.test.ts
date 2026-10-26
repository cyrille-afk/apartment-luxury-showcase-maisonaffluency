import { describe, expect, it } from "vitest";
import { FELIX_STEP_SIDEBAR, type TourSidebarAnchor } from "./felixTourSidebarMap";

// The 23 onboarding step ids, in tour order (mirrors FELIX_STEPS in FelixTour.tsx).
const STEP_IDS = [
  "welcome", "tier-tracking", "collection", "quotes",
  "client-safe-presentations", "margin-protection", "quote-generation",
  "direct-client-billing", "projects", "tools", "settings",
  "portfolio-management", "client-view", "branding-panel", "white-label",
  "invite", "bespoke-commissions", "technical-assets", "felix-chat",
  "priority-concierge", "ai-extension-sync", "pwa-install", "beta-feedboard",
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
  it("points both Client View steps at the top-right header control, not the sidebar", () => {
    for (const id of ["client-safe-presentations", "margin-protection"]) {
      expect(FELIX_STEP_SIDEBAR[id].where).toBe("header");
      expect(FELIX_STEP_SIDEBAR[id].label).toBe("Client Editorial Presentation");
    }
  });
});
