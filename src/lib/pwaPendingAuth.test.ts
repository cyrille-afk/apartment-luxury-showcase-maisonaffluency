import { beforeEach, describe, expect, it } from "vitest";
import {
  PENDING_AUTH_STORAGE_KEY,
  clearPendingAuthToken,
  parsePendingAuth,
  readPendingAuthToken,
  serializePendingAuth,
  storePendingAuthToken,
} from "./pwaPendingAuth";

const VALID_TOKEN = "a".repeat(43);

describe("pwaPendingAuth", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a token through localStorage", () => {
    storePendingAuthToken(VALID_TOKEN, 120);
    expect(readPendingAuthToken()).toBe(VALID_TOKEN);
  });

  it("stores under the ma_pwa_pending_auth_token key with an expiry", () => {
    storePendingAuthToken(VALID_TOKEN, 120);
    const raw = window.localStorage.getItem(PENDING_AUTH_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.token).toBe(VALID_TOKEN);
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects and clears an expired token", () => {
    window.localStorage.setItem(
      PENDING_AUTH_STORAGE_KEY,
      serializePendingAuth({ token: VALID_TOKEN, expiresAt: Date.now() - 1000 }),
    );
    expect(readPendingAuthToken()).toBeNull();
    expect(window.localStorage.getItem(PENDING_AUTH_STORAGE_KEY)).toBeNull();
  });

  it("rejects and clears malformed payloads", () => {
    window.localStorage.setItem(PENDING_AUTH_STORAGE_KEY, "not-json");
    expect(readPendingAuthToken()).toBeNull();
    expect(window.localStorage.getItem(PENDING_AUTH_STORAGE_KEY)).toBeNull();

    window.localStorage.setItem(PENDING_AUTH_STORAGE_KEY, JSON.stringify({ token: "short", expiresAt: Date.now() + 1000 }));
    expect(readPendingAuthToken()).toBeNull();
  });

  it("parsePendingAuth honors an explicit clock", () => {
    const raw = serializePendingAuth({ token: VALID_TOKEN, expiresAt: 5000 });
    expect(parsePendingAuth(raw, 4999)?.token).toBe(VALID_TOKEN);
    expect(parsePendingAuth(raw, 5000)).toBeNull();
  });

  it("clearPendingAuthToken removes the entry", () => {
    storePendingAuthToken(VALID_TOKEN, 120);
    clearPendingAuthToken();
    expect(readPendingAuthToken()).toBeNull();
  });
});

import { claimFirstLaunchToken } from "./pwaPendingAuth";

describe("claimFirstLaunchToken", () => {
  it("accepts a launch code once, then ignores the same code on later icon taps", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(claimFirstLaunchToken("a".repeat(43), storage)).toBe(true);
    expect(claimFirstLaunchToken("a".repeat(43), storage)).toBe(false);
    expect(claimFirstLaunchToken("b".repeat(43), storage)).toBe(true);
  });
});
