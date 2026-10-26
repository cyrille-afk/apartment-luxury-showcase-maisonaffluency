import { describe, expect, it } from "vitest";
import { FELIX_STEP_ORDER, orderFelixSteps } from "./felixTourOrder";

describe("onboarding sequence", () => {
  it("places Client Project Folders at Step 9 between billing and Tools", () => {
    const steps = orderFelixSteps([...FELIX_STEP_ORDER].reverse().map(id => ({ id })));
    expect(steps[7]?.id).toBe("direct-client-billing");
    expect(steps[8]?.id).toBe("projects");
    expect(steps[9]?.id).toBe("tools");
  });
  it("keeps both tier steps together right after Welcome, before the Collection", () => {
    expect(FELIX_STEP_ORDER.slice(0, 4)).toEqual(["welcome", "tier-tracking", "collection", "quotes"]);
    expect(FELIX_STEP_ORDER).toHaveLength(23);
    expect(new Set(FELIX_STEP_ORDER).size).toBe(23);
  });
  it("groups the later steps by sidebar section so the tour never ping-pongs", () => {
    // Steps 12-16 stay on Projects & Interventions, 17-18 on Tools,
    // 19-20 on Trade Concierge, then extension sync, mobile app, finale.
    expect(FELIX_STEP_ORDER.slice(11, 16)).toEqual([
      "portfolio-management", "client-view", "branding-panel", "white-label", "invite",
    ]);
    expect(FELIX_STEP_ORDER.slice(16, 18)).toEqual(["bespoke-commissions", "technical-assets"]);
    expect(FELIX_STEP_ORDER.slice(18, 20)).toEqual(["felix-chat", "priority-concierge"]);
    expect(FELIX_STEP_ORDER.slice(20)).toEqual(["ai-extension-sync", "pwa-install", "beta-feedboard"]);
  });
});
