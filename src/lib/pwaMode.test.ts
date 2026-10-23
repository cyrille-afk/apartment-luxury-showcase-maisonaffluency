import { afterEach, describe, expect, it, vi } from "vitest";
import { isInstalledPwaDisplay } from "./pwaMode";

afterEach(() => vi.restoreAllMocks());
describe("actual installed container detection", () => {
  it("detects standalone display mode", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    expect(isInstalledPwaDisplay()).toBe(true);
  });
  it("detects iOS standalone when display mode is false", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    expect(isInstalledPwaDisplay()).toBe(true);
    Reflect.deleteProperty(navigator, "standalone");
  });
  it("does not authenticate a normal browser based on a PWA URL hint", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
    history.replaceState(null, "", "/?source=pwa");
    expect(isInstalledPwaDisplay()).toBe(false);
    history.replaceState(null, "", "/");
  });
});