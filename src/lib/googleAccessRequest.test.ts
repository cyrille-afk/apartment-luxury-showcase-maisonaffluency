import { describe, expect, it } from "vitest";
import { googleAccessInquiry, googleAccessRequestSchema } from "./googleAccessRequest";

describe("Google Trade access requests", () => {
  it("records the requested name and normalized email without granting account access", () => {
    expect(googleAccessInquiry({ name: " Gregoire ", email: " Person@GMAIL.com " })).toMatchObject({
      name: "Gregoire", email: "person@gmail.com", source: "contact_form",
    });
    expect(googleAccessInquiry({ name: "Gregoire", email: "person@gmail.com", role: "admin", status: "approved" })).not.toHaveProperty("role");
    expect(googleAccessInquiry({ name: "Gregoire", email: "person@gmail.com", status: "approved" })).not.toHaveProperty("status");
  });
  it("rejects blank names, invalid emails and inputs exceeding server limits", () => {
    for (const data of [
      { name: " ", email: "person@gmail.com" },
      { name: "Gregoire", email: "not-an-email" },
      { name: "x".repeat(101), email: "person@gmail.com" },
      { name: "Gregoire", email: `${"a".repeat(250)}@gmail.com` },
    ]) expect(googleAccessRequestSchema.safeParse(data).success).toBe(false);
  });
});