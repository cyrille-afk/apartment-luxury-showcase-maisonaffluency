import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCatalogBatches } from "./useCatalogBatches";

describe("catalogue scroll batches", () => {
  afterEach(() => vi.unstubAllGlobals());
  function setup(total = 592) {
    let notify: IntersectionObserverCallback = () => {};
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe() {} disconnect() {}
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
    const hook = renderHook(({ key, items }) => {
      const result = useCatalogBatches(items, key);
      result.sentinelRef.current = document.createElement("div");
      return result;
    }, { initialProps: { key: "all", items: Array.from({ length: total }, (_, i) => i) } });
    const scroll = () => act(() => notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    return { ...hook, scroll };
  }
  it("mounts 24 initially and appends only 24 per scroll through all 592 pieces", () => {
    const { result, scroll } = setup();
    expect(result.current.renderedItems).toHaveLength(24);
    scroll();
    expect(result.current.renderedItems).toHaveLength(48);
    for (let i = 0; i < 23; i++) scroll();
    expect(result.current.renderedItems).toHaveLength(592);
    expect(new Set(result.current.renderedItems).size).toBe(592);
    expect(result.current.hasMore).toBe(false);
  });
  it("resets immediately when filters change and preserves append order", () => {
    const { result, scroll, rerender } = setup();
    scroll();
    expect(result.current.renderedItems.slice(0, 24)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    rerender({ key: "living", items: Array.from({ length: 100 }, (_, i) => i + 1000) });
    expect(result.current.renderedItems).toHaveLength(24);
    expect(result.current.renderedItems[0]).toBe(1000);
  });
  it("does not paginate short or empty results", () => {
    const { result, rerender } = setup(9);
    expect(result.current.renderedItems).toHaveLength(9);
    expect(result.current.hasMore).toBe(false);
    rerender({ key: "none", items: [] });
    expect(result.current.renderedItems).toHaveLength(0);
    expect(result.current.hasMore).toBe(false);
  });
});