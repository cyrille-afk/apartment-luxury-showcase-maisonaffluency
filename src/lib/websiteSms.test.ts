import { describe, expect, it } from "vitest";
import { WEBSITE_SMS_RECIPIENT, websiteSmsMessage } from "./websiteSms";

describe("website SMS alerts", () => {
  it("sends to the requested Singapore number", () => {
    expect(WEBSITE_SMS_RECIPIENT).toBe("+6591393850");
  });
  it("distinguishes outage and recovery", () => {
    expect(websiteSmsMessage("outage", "/")).toContain("is unavailable");
    expect(websiteSmsMessage("recovery", "/")).toContain("has recovered");
  });
  it("does not allow arbitrary paths in messages", () => {
    expect(() => websiteSmsMessage("outage", "fn:private")).toThrow();
  });
});