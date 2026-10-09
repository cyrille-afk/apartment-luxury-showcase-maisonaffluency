import { describe, expect, it, beforeEach } from "vitest";
import { applyFactOverrides, loadFactOverrides, persistFactOverrides, clearFactOverrides, mergeLockedFacts } from "./felixLockedFacts";

describe("felix fact overrides", () => {
  beforeEach(() => { localStorage.clear(); });

  it("user corrections win over detected facts", () => {
    const base = { projectProfile: "Brownstone", zone: "living room", budget: "$50k" };
    const out = applyFactOverrides(base, { projectProfile: "Good Class Bungalow, Sentosa" });
    expect(out.projectProfile).toBe("Good Class Bungalow, Sentosa");
    expect(out.zone).toBe("living room");
    expect(out.budget).toBe("$50k");
  });

  it("an empty override clears a wrongly-detected fact", () => {
    const base = { projectProfile: "Brownstone", zone: "living room", budget: "" };
    const out = applyFactOverrides(base, { projectProfile: "" });
    expect(out.projectProfile).toBe("");
  });

  it("overrides persist and reload", () => {
    persistFactOverrides({ zone: "dining room" });
    expect(loadFactOverrides()).toEqual({ zone: "dining room" });
    clearFactOverrides();
    expect(loadFactOverrides()).toEqual({});
  });

  it("monotonic merge still refuses to downgrade real values", () => {
    const locked = { projectProfile: "Prewar Co-op", zone: "", budget: "" };
    const out = mergeLockedFacts(locked, { projectProfile: "Brownstone", zone: "salon" });
    expect(out.projectProfile).toBe("Prewar Co-op");
    expect(out.zone).toBe("salon");
  });
});
