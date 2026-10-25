import { describe, expect, it } from "vitest";
import { availability } from "./websiteStatus";

describe("public availability", () => {
  const now = Date.parse("2026-10-25T00:30:00Z");
  it("does not claim availability when monitoring is stale", () => {
    expect(availability(true, "2026-10-25T00:19:59Z", now)).toBe("unknown");
  });
  it("shows a fresh failed probe as unavailable", () => {
    expect(availability(false, "2026-10-25T00:25:00Z", now)).toBe("unavailable");
  });
  it("shows a fresh successful probe as operational", () => {
    expect(availability(true, "2026-10-25T00:25:00Z", now)).toBe("operational");
  });
});