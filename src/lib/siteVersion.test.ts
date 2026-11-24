import { afterEach, describe, expect, it, vi } from "vitest";
import { siteBuildLabel } from "./siteVersion";

afterEach(() => { vi.unstubAllEnvs(); });

describe("siteBuildLabel", () => {
  it("formats the baked build time as a UTC date and time", () => {
    vi.stubEnv("VITE_APP_BUILD_TIME", "2026-11-24T13:02:00.000Z");
    expect(siteBuildLabel()).toBe("24 Nov 2026 · 13:02 UTC");
  });
  it("returns null when no build time is baked in", () => {
    vi.stubEnv("VITE_APP_BUILD_TIME", "");
    expect(siteBuildLabel()).toBeNull();
  });
});
