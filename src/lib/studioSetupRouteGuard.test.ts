import { describe, expect, it, vi } from "vitest";
import { guardStudioSetupRoute } from "./studioSetupRouteGuard";

describe("direct trade route setup guard", () => {
  it.each(["/trade", "/trade/dashboard", "/trade/the-collection", "/trade/visualiser", "/trade/quotes", "/trade/projects/first-project/studio"])("redirects incomplete direct entry %s before loading", async pathname => {
    await expect(guardStudioSetupRoute({ pathname, preload: false }, async () => false)).rejects.toMatchObject({ options: { to: "/settings/studio", search: { studioSetup: "required" }, replace: true } });
  });
  it.each(["/settings/studio", "/trade/settings/studio", "/trade/settings/studio/"])("never loops Studio Settings %s", async pathname => {
    const read = vi.fn(async () => false);
    await guardStudioSetupRoute({ pathname, preload: false }, read);
    expect(read).not.toHaveBeenCalled();
  });
  it("allows complete accounts", async () => {
    await expect(guardStudioSetupRoute({ pathname: "/trade/quotes", preload: false }, async () => true)).resolves.toBeUndefined();
  });
  it("preserves signed-out/non-trade/application handling", async () => {
    await expect(guardStudioSetupRoute({ pathname: "/trade", preload: false }, async () => null)).resolves.toBeUndefined();
  });
  it("does not redirect from preloading a link", async () => {
    const read = vi.fn(async () => false);
    await guardStudioSetupRoute({ pathname: "/trade/quotes", preload: true }, read);
    expect(read).not.toHaveBeenCalled();
  });
  it("retries failed readiness reads rather than treating them as incomplete", async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(true);
    await expect(guardStudioSetupRoute({ pathname: "/trade/quotes", preload: false }, read)).resolves.toBeUndefined();
    expect(read).toHaveBeenCalledTimes(2);
  });
});