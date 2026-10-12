import { describe, expect, it } from "vitest";
import { readGoogleAttempt, safeGoogleReturnPath } from "./googleSignInRecovery";

const storage = (value: string | null) => ({ getItem: () => value });
describe("Google sign-in recovery", () => {
  it("does not treat an ordinary login as a failed Google return", () => {
    expect(readGoogleAttempt(storage(null), 1000)).toBeNull();
  });
  it("retains the intended client management destination", () => {
    expect(readGoogleAttempt(storage(JSON.stringify({ next: "/trade/client-management", startedAt: 1000 })), 2000)).toBe("/trade/client-management");
  });
  it("ignores stale or malformed attempts", () => {
    expect(readGoogleAttempt(storage(JSON.stringify({ next: "/trade", startedAt: 1000 })), 1801000)).toBeNull();
    expect(readGoogleAttempt(storage("not json"), 1000)).toBeNull();
  });
  it("never sends recovery outside the app or back into login", () => {
    for (const path of ["//example.com", "/\\example.com", "https://example.com", "/trade/login?next=/trade"]) {
      expect(safeGoogleReturnPath(path)).toBe("/trade");
    }
  });
});