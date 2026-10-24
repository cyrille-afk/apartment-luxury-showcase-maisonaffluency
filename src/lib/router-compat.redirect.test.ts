import { describe, expect, it } from "vitest";
import { shouldFireRedirect } from "./router-compat";

describe("Navigate one-shot guard", () => {
  it("fires once, ignores repeat mounts for the same target, then allows it again later", () => {
    const key = `/trade/products/x/y-${Math.random()}`;
    expect(shouldFireRedirect(key, 1000)).toBe(true);
    expect(shouldFireRedirect(key, 1500)).toBe(false);
    expect(shouldFireRedirect(key, 4999)).toBe(false);
    expect(shouldFireRedirect(key, 5000)).toBe(true);
  });
});
