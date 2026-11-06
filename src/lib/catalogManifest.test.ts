import { describe, expect, it } from "vitest";
import { isStaticManifestFresh } from "./catalogManifest";

describe("static catalogue freshness", () => {
  const now = Date.parse("2026-11-06T08:40:00.000Z");

  it("uses a build-time manifest for four minutes", () => {
    expect(isStaticManifestFresh("2026-11-06T08:36:00.000Z", now)).toBe(true);
  });

  it("falls back to the live manifest after five minutes", () => {
    expect(isStaticManifestFresh("2026-11-06T08:34:59.000Z", now)).toBe(false);
  });

  it("rejects missing or future timestamps instead of trusting stale data", () => {
    expect(isStaticManifestFresh("", now)).toBe(false);
    expect(isStaticManifestFresh("2026-11-06T08:41:00.000Z", now)).toBe(false);
  });
});
