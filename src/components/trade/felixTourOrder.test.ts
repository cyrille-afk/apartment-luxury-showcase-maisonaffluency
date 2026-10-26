import { describe, expect, it } from "vitest";
import { FELIX_STEP_ORDER, orderFelixSteps } from "./felixTourOrder";

describe("onboarding sequence", () => {
  it("places Client Project Folders at Step 9 between billing and Tools", () => {
    const steps = orderFelixSteps([...FELIX_STEP_ORDER].reverse().map(id => ({ id })));
    expect(steps[7]?.id).toBe("direct-client-billing");
    expect(steps[8]?.id).toBe("projects");
    expect(steps[9]?.id).toBe("tools");
  });
  it("renumbers the preceding pricing and quote steps without changing the 23-step total", () => {
    expect(FELIX_STEP_ORDER.slice(3, 8)).toEqual(["tier-tracking", "client-safe-presentations", "margin-protection", "quote-generation", "direct-client-billing"]);
    expect(FELIX_STEP_ORDER).toHaveLength(23);
    expect(new Set(FELIX_STEP_ORDER).size).toBe(23);
  });
});