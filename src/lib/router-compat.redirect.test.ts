import { describe, expect, it } from "vitest";
import { shouldFireRedirect } from "./router-compat";

describe("Navigate one-shot guard", () => {
  it("suppresses remounts while the same resolved visit is loading", () => {
    const router = {};
    expect(shouldFireRedirect(router, "source-1", "/trade/products/x", 1000)).toBe(true);
    expect(shouldFireRedirect(router, "source-1", "/trade/products/x", 1500)).toBe(false);
    expect(shouldFireRedirect(router, "source-1", "/trade/products/x", 4999)).toBe(false);
    expect(shouldFireRedirect(router, "source-1", "/trade/products/x", 5000)).toBe(true);
  });
  it("allows a new visit to redirect immediately to the same target", () => {
    const router = {};
    expect(shouldFireRedirect(router, "source-1", "/trade/products/x", 1000)).toBe(true);
    expect(shouldFireRedirect(router, "source-2", "/trade/products/x", 1001)).toBe(true);
  });
  it("does not suppress redirects in another router", () => {
    expect(shouldFireRedirect({}, "source", "/trade", 1000)).toBe(true);
    expect(shouldFireRedirect({}, "source", "/trade", 1001)).toBe(true);
  });
  it("allows a history entry revisited after another resolved visit", () => {
    const router = {};
    expect(shouldFireRedirect(router, "source-1", "/trade", 1000)).toBe(true);
    expect(shouldFireRedirect(router, "other-visit", "/other", 1001)).toBe(true);
    expect(shouldFireRedirect(router, "source-1", "/trade", 1002)).toBe(true);
  });
});
