import { describe, expect, it } from "vitest";
import { ART_DECO_DISCOVERY_REPLY, briefFactsFromText, evaluateFelixOnboardingGate, isHighLevelVisionStatement } from "./felixOnboardingGate";

describe("Felix onboarding gate", () => {
  it("rejects placeholders and requires the three gate facts", () => {
    const draft = "PROJECT PROFILE: [typology, city/area]\nZONE: Living room\nBUDGET: [currency and target range]";
    expect(evaluateFelixOnboardingGate(draft, [], true).completed).toBe(false);
  });

  it("unlocks only after valid facts and manual completion", () => {
    const draft = "PROJECT PROFILE: Prewar co-op, New York\nZONE: Salon and dining area\nBUDGET: USD 150,000";
    expect(briefFactsFromText(draft).budget).toBe("USD 150,000");
    expect(evaluateFelixOnboardingGate(draft, [], false).completed).toBe(false);
    expect(evaluateFelixOnboardingGate(draft, [], true).completed).toBe(true);
  });

  it("routes a high-level FF&E vision back to discovery", () => {
    expect(isHighLevelVisionStatement("I'm gathering FF&E ideas for a prewar co-op with a strong art deco vibe")).toBe(true);
    expect(ART_DECO_DISCOVERY_REPLY).toContain("target budget range");
    expect(ART_DECO_DISCOVERY_REPLY).toContain("which specific zones");
  });
});