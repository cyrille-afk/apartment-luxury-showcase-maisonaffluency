import { describe, expect, it } from "vitest";
import { FELIX_STEP_ORDER, orderFelixSteps } from "./felixTourOrder";

describe("onboarding sequence", () => {
  it("keeps both tier steps together right after Welcome, before the Collection", () => {
    expect(FELIX_STEP_ORDER.slice(0, 4)).toEqual(["welcome", "tier-tracking", "collection", "quotes"]);
    expect(FELIX_STEP_ORDER).toHaveLength(23);
    expect(new Set(FELIX_STEP_ORDER).size).toBe(23);
  });
  it("opens the Projects block with Client Project Folders (Steps 9-14)", () => {
    const steps = orderFelixSteps([...FELIX_STEP_ORDER].reverse().map(id => ({ id })));
    expect(steps[7]?.id).toBe("direct-client-billing");
    expect(FELIX_STEP_ORDER.slice(8, 14)).toEqual([
      "projects", "portfolio-management", "client-view", "branding-panel", "white-label", "invite",
    ]);
  });
  it("opens the Tools block with the Tools Grid (Steps 15-17)", () => {
    expect(FELIX_STEP_ORDER.slice(14, 17)).toEqual(["tools", "bespoke-commissions", "technical-assets"]);
  });
  it("keeps Concierge together, then sync and mobile, with Settings leading into the studio-setup finale", () => {
    expect(FELIX_STEP_ORDER.slice(17, 19)).toEqual(["felix-chat", "priority-concierge"]);
    expect(FELIX_STEP_ORDER.slice(19)).toEqual(["ai-extension-sync", "pwa-install", "settings", "beta-feedboard"]);
  });
});
