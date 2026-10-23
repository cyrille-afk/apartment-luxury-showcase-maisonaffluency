import { beforeEach, describe, expect, it } from "vitest";
import base from "../../public/manifest.json";
import { launchManifestResponse, mobileManifestHref, takeLaunchToken } from "./pwaLaunchManifest";
import { readPendingAuthToken, storePendingAuthToken } from "./pwaPendingAuth";

const token = "q".repeat(43);
beforeEach(() => { window.localStorage.clear(); window.history.replaceState({}, "", "/"); });

describe("per-install launch handoff", () => {
  it("puts the one-time code in start_url without changing installed app identity", async () => {
    const response = launchManifestResponse(new Request(`https://www.maisonaffluency.com/mobile-manifest.json?token=${token}`));
    expect(await response.json()).toEqual({ ...base, start_url: `/?source=pwa&token=${token}` });
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });
  it("retains the standard launch URL for malformed or missing codes", async () => {
    for (const query of ["", "?token=bad", `?token=${token}%26next%3Dexternal`]) {
      const response = launchManifestResponse(new Request(`https://www.maisonaffluency.com/mobile-manifest.json${query}`));
      expect((await response.json()).start_url).toBe("/?source=pwa");
    }
  });
  it("uses a dynamic manifest only on the token bridge", () => {
    expect(mobileManifestHref("/auth/sync", `?t=${token}`)).toBe(`/mobile-manifest.json?token=${token}`);
    expect(mobileManifestHref("/auth/sync", `?token=${token}`)).toBe(`/mobile-manifest.json?token=${token}`);
    expect(mobileManifestHref("/trade", `?token=${token}`)).toBe("/manifest.json");
  });
  it("captures a code with empty container storage and scrubs it without losing history state", () => {
    window.history.replaceState({ key: "router" }, "", `/?source=pwa&token=${token}`);
    expect(readPendingAuthToken()).toBeNull();
    expect(takeLaunchToken()).toBe(token);
    expect(window.location.search).toBe("?source=pwa");
    expect(window.history.state).toEqual({ key: "router" });
    expect(takeLaunchToken()).toBeNull();
  });
  it("stages launch tokens for no more than two minutes locally", () => {
    storePendingAuthToken(token, 120);
    const saved = JSON.parse(window.localStorage.getItem("ma_pwa_pending_auth_token") ?? "{}");
    expect(saved.expiresAt - Date.now()).toBeGreaterThan(119000);
    expect(saved.expiresAt - Date.now()).toBeLessThanOrEqual(120000);
  });
  it("does not intercept unrelated browser links", () => {
    window.history.replaceState({}, "", `/auth/sync?token=${token}`);
    expect(takeLaunchToken()).toBeNull();
    expect(window.location.pathname).toBe("/auth/sync");
  });
});