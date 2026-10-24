import { describe, it, expect } from "vitest";
import { emailKey, findDuplicateGroups, validateDecision, type AuthUserLike } from "./duplicateAccounts";

const pw: AuthUserLike = { id: "a", email: "Greg.A@gmail.com", email_confirmed_at: "x", identities: [{ provider: "email" }] };
const gg: AuthUserLike = {
  id: "b",
  email: "grega@gmail.com",
  email_confirmed_at: "x",
  identities: [{ provider: "google", identity_data: { email: "grega@gmail.com", email_verified: true } }],
};
const other: AuthUserLike = { id: "c", email: "other@x.com", identities: [{ provider: "email" }] };

const base = { primaryUserId: "a", duplicateUserId: "b", passwordVerified: true, googleVerified: true, callerId: "z", adminIds: new Set<string>() };

describe("duplicate accounts", () => {
  it("treats Gmail dots and +tags as the same address", () => {
    expect(emailKey("Greg.A+trade@googlemail.com")).toBe("grega@gmail.com");
  });
  it("groups password and Google accounts sharing an email", () => {
    const g = findDuplicateGroups([pw, gg, other]);
    expect(g).toHaveLength(1);
    expect(g[0].accounts.map((a) => a.userId).sort()).toEqual(["a", "b"]);
  });
  const group = findDuplicateGroups([pw, gg])[0];
  it("blocks suspension unless both identities are confirmed by the admin", () => {
    expect(validateDecision({ ...base, group, decision: "suspend_duplicate", googleVerified: false })).not.toBeNull();
  });
  it("allows suspension when both identities are verified", () => {
    expect(validateDecision({ ...base, group, decision: "suspend_duplicate" })).toBeNull();
  });
  it("never suspends an admin or the reviewer", () => {
    expect(validateDecision({ ...base, group, decision: "suspend_duplicate", adminIds: new Set(["b"]) })).not.toBeNull();
    expect(validateDecision({ ...base, group, decision: "suspend_duplicate", callerId: "b" })).not.toBeNull();
  });
  it("rejects accounts outside the group", () => {
    expect(validateDecision({ ...base, group, duplicateUserId: "c", decision: "keep_both" })).not.toBeNull();
  });
});
