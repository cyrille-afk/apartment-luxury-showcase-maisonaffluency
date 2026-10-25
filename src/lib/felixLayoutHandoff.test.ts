import { describe, expect, it } from "vitest";
import { shouldOfferArchitecturalIntake } from "./felixLayoutHandoff";

const opening = { builderSubmit: false, completed: false, hasProposal: false, builderOpen: false, hasAttachments: false };
describe("architectural layout continuation", () => {
  it("offers intake for a new project", () => expect(shouldOfferArchitecturalIntake(opening)).toBe(true));
  it("never restarts intake after the Bangkok brief is complete and Option 3 is chosen", () => {
    expect(shouldOfferArchitecturalIntake({ ...opening, completed: true })).toBe(false);
  });
  it("never treats an explicit brief submission as opening intake", () => {
    expect(shouldOfferArchitecturalIntake({ ...opening, builderSubmit: true })).toBe(false);
  });
});