import { describe, it, expect } from "vitest";
import { mergeLockedFacts, EMPTY_LOCKED_FACTS } from "@/lib/felixLockedFacts";

describe("felix locked facts", () => {
  it("locks the first verified value", () => {
    const locked = mergeLockedFacts(EMPTY_LOCKED_FACTS, { projectProfile: "Prewar Co-op" });
    expect(locked.projectProfile).toBe("Prewar Co-op");
  });

  it("never lets a resume/timeout event overwrite a verified profile", () => {
    const locked = mergeLockedFacts(EMPTY_LOCKED_FACTS, { projectProfile: "Prewar Co-op" });
    const after = mergeLockedFacts(locked, { projectProfile: "Brownstone" });
    expect(after.projectProfile).toBe("Prewar Co-op");
  });

  it("ignores placeholders and empty strings", () => {
    const locked = mergeLockedFacts(EMPTY_LOCKED_FACTS, { zone: "[zone]" });
    expect(locked.zone).toBe("");
    expect(mergeLockedFacts(locked, { zone: "" }).zone).toBe("");
    expect(mergeLockedFacts(locked, { zone: "dining room" }).zone).toBe("dining room");
  });
});
