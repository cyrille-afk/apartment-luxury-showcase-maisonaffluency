import { describe, expect, it } from "vitest";
import { isTradeLoginPath, normalizedTradeLoginSearch, tradeLoginHref, tradeLoginReturnPath } from "./tradeLoginReturn";

describe("Trade sign-in return destinations", () => {
  it("keeps exactly one question mark when the router search already has one", () => {
    expect(tradeLoginHref("/trade/projects/example/studio", "??room=living")).toBe("/trade/login?next=%2Ftrade%2Fprojects%2Fexample%2Fstudio%3Froom%3Dliving");
  });
  it("unwraps existing repeated login addresses to the original destination", () => {
    let next = "/trade/quotes?status=draft";
    for (let i = 0; i < 20; i++) next = `/trade/login??next=${encodeURIComponent(next)}`;
    expect(tradeLoginReturnPath(next)).toBe("/trade/quotes?status=draft");
    expect(normalizedTradeLoginSearch(`?next=${encodeURIComponent(next)}`)).toEqual({ next: "/trade/quotes?status=draft" });
  });
  it("uses the dashboard for a truncated recursive link", () => {
    expect(tradeLoginReturnPath("/trade/login??next=%252525")).toBe("/trade");
  });
  it("does not change an already clean return destination", () => {
    expect(normalizedTradeLoginSearch("?next=%2Ftrade%2Fquotes&google_recovery=1")).toBeNull();
  });
  it("preserves invitation and recovery parameters while cleaning legacy links", () => {
    const next = "/trade/me?studioInvite=11111111-1111-4111-8111-111111111111";
    expect(normalizedTradeLoginSearch(`?redirect=${encodeURIComponent(next)}&google_recovery=1`)).toEqual({ next, google_recovery: "1" });
  });
  it.each(["https://example.com", "//example.com", "/\\example.com"])("rejects external return address %s", next => {
    expect(tradeLoginReturnPath(next)).toBe("/trade");
  });
  it("recognizes login with a trailing slash without matching other trade pages", () => {
    expect(isTradeLoginPath("/trade/login/")).toBe(true);
    expect(isTradeLoginPath("/trade/quotes")).toBe(false);
  });
});