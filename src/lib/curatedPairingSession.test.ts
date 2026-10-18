import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  sessionStorage.clear();
  vi.resetModules();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Curated Pairings shopping-session dismissal", () => {
  it("stays dismissed for other drawers and after navigation remounts", async () => {
    const { useCuratedPairingSession } = await import("./curatedPairingSession");
    const first = renderHook(useCuratedPairingSession);
    const other = renderHook(useCuratedPairingSession);
    expect(first.result.current.dismissed).toBe(false);
    act(() => first.result.current.dismiss());
    expect(other.result.current.dismissed).toBe(true);
    first.unmount();
    const reopened = renderHook(useCuratedPairingSession);
    expect(reopened.result.current.dismissed).toBe(true);
  });

  it("retains dismissal after a page reload without changing the cart", async () => {
    const cart = '{"lines":[{"title":"Tassel 57 Pendant","quantity":2}]}';
    localStorage.setItem("ma_cart_v1", cart);
    const initial = await import("./curatedPairingSession");
    const drawer = renderHook(initial.useCuratedPairingSession);
    act(() => drawer.result.current.dismiss());
    drawer.unmount();
    vi.resetModules();
    const reloaded = await import("./curatedPairingSession");
    expect(renderHook(reloaded.useCuratedPairingSession).result.current.dismissed).toBe(true);
    expect(localStorage.getItem("ma_cart_v1")).toBe(cart);
  });

  it("allows recommendations in a new shopping session", async () => {
    const initial = await import("./curatedPairingSession");
    const drawer = renderHook(initial.useCuratedPairingSession);
    act(() => drawer.result.current.dismiss());
    drawer.unmount();
    sessionStorage.clear();
    vi.resetModules();
    const fresh = await import("./curatedPairingSession");
    expect(renderHook(fresh.useCuratedPairingSession).result.current.dismissed).toBe(false);
  });

  it("still suppresses later drawers if session storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const { useCuratedPairingSession } = await import("./curatedPairingSession");
    const drawer = renderHook(useCuratedPairingSession);
    act(() => drawer.result.current.dismiss());
    expect(renderHook(useCuratedPairingSession).result.current.dismissed).toBe(true);
  });
});