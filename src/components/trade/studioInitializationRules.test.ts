import { describe, expect, it } from "vitest";
import { canInitializeStep, initializationEmails } from "./studioInitializationRules";
describe("studio initialization", () => {
  it("requires a studio name", () => { expect(canInitializeStep(1, " ", "")).toBe(false); expect(canInitializeStep(1, "Delval Studio", "")).toBe(true); });
  it("allows skipping all team invitations", () => { expect(initializationEmails(["", " "])).toEqual([]); });
  it("requires valid teammate emails", () => { expect(() => initializationEmails(["not-an-email"])).toThrow(); });
  it("deduplicates teammate rows", () => { expect(initializationEmails([" Person@example.com ", "person@example.com"])).toEqual(["person@example.com"]); });
  it("requires the first project name", () => { expect(canInitializeStep(3, "Delval Studio", " ")).toBe(false); expect(canInitializeStep(3, "Delval Studio", "New Residential Project")).toBe(true); });
});