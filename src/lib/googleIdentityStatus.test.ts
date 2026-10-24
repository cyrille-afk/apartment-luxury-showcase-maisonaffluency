import { describe, it, expect } from "vitest";
import { getGoogleIdentityStatus } from "./googleIdentityStatus";

const confirmed = "2026-01-01T00:00:00Z";

describe("getGoogleIdentityStatus", () => {
  it("matched when Google email equals verified email (case-insensitive)", () => {
    expect(
      getGoogleIdentityStatus({
        email: "a@b.com",
        email_confirmed_at: confirmed,
        identities: [{ provider: "google", identity_data: { email: "A@B.com" } }],
      }).kind,
    ).toBe("matched");
  });
  it("mismatch when Google email differs", () => {
    expect(
      getGoogleIdentityStatus({
        email: "a@b.com",
        email_confirmed_at: confirmed,
        identities: [{ provider: "google", identity_data: { email: "x@gmail.com" } }],
      }).kind,
    ).toBe("mismatch");
  });
  it("not_linked for verified password-only account", () => {
    expect(
      getGoogleIdentityStatus({ email: "a@b.com", email_confirmed_at: confirmed, identities: [{ provider: "email" }] }).kind,
    ).toBe("not_linked");
  });
  it("unverified when email not confirmed and no Google", () => {
    expect(getGoogleIdentityStatus({ email: "a@b.com", email_confirmed_at: null, identities: [] }).kind).toBe("unverified");
  });
});
