import { describe, expect, it, vi } from "vitest";
vi.mock("@/hooks/useConciergeSession", () => ({ updateConciergeSession: vi.fn() }));
import { validateBriefDraft } from "./BriefBuilder";

describe("brief required details", () => {
  it("does not consume the following label as an empty required value", () => {
    const result = validateBriefDraft("Block 1 — Spatial & Project Context\nPROJECT PROFILE: \nZONE: \nBUDGET: \nENVIRONMENT: Indoor\nTIMELINE: Soon");
    expect(result).toEqual({ valid: false, missing: ["PROJECT PROFILE", "ZONE", "BUDGET"] });
  });
  it("accepts the three explicit required details", () => {
    expect(validateBriefDraft("Block 1 — Spatial & Project Context\nPROJECT PROFILE: Residence in Singapore\nZONE: Living room\nBUDGET: EUR 50000")).toEqual({ valid: true, missing: [] });
  });
});