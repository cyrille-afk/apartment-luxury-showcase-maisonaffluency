import { describe, expect, it } from "vitest";
import { canUseAiLayout } from "./aiLayoutAccess";

describe("canUseAiLayout", () => {
  it("allows admins regardless of tier", () => {
    expect(canUseAiLayout({ isAdmin: true, tier: "silver" })).toBe(true);
  });

  it("allows gold trade members", () => {
    expect(canUseAiLayout({ isAdmin: false, tier: "gold" })).toBe(true);
  });

  it("allows platinum trade members", () => {
    expect(canUseAiLayout({ isAdmin: false, tier: "platinum" })).toBe(true);
  });

  it("denies silver trade members", () => {
    expect(canUseAiLayout({ isAdmin: false, tier: "silver" })).toBe(false);
  });

  it("denies when status has not loaded yet", () => {
    expect(canUseAiLayout(null)).toBe(false);
    expect(canUseAiLayout(undefined)).toBe(false);
  });
});
