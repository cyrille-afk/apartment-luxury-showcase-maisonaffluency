import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTradeGalleryScroll } from "./useTradeGalleryScroll";
import { saveTradeGalleryState } from "@/lib/tradeGalleryState";

const PATH = "/trade/gallery/michel-amar-studio";
const STATE = {
  search: "",
  brand: "Michel Amar Studio",
  category: "all",
  subcategory: "all",
  edition: "all",
  sortBy: "curated" as const,
  viewMode: "grid" as const,
};

function mockPageHeight() {
  Object.defineProperty(document.documentElement, "scrollHeight", { value: 5000, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 1000, configurable: true });
}

async function flushFrames() {
  await new Promise((r) => setTimeout(r, 60));
}

describe("useTradeGalleryScroll", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockPageHeight();
    window.scrollTo({ top: 0 });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lands at the top on a fresh visit even when a scroll position was saved", async () => {
    saveTradeGalleryState(PATH, { ...STATE, scrollY: 800 }, "");
    const spy = vi.spyOn(window, "scrollTo");
    renderHook(() => useTradeGalleryScroll(PATH, "", STATE, false));
    await flushFrames();
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ top: 800 }));
  });

  it("restores the saved position after a back/forward (popstate) navigation", async () => {
    saveTradeGalleryState(PATH, { ...STATE, scrollY: 800 }, "");
    window.dispatchEvent(new PopStateEvent("popstate"));
    const spy = vi.spyOn(window, "scrollTo");
    renderHook(() => useTradeGalleryScroll(PATH, "", STATE, false));
    await flushFrames();
    expect(spy).toHaveBeenCalledWith({ top: 800, behavior: "instant" });
  });

  it("does not restore after an in-app link click (pushState)", async () => {
    window.dispatchEvent(new PopStateEvent("popstate"));
    history.pushState({}, "", PATH);
    saveTradeGalleryState(PATH, { ...STATE, scrollY: 800 }, "");
    const spy = vi.spyOn(window, "scrollTo");
    renderHook(() => useTradeGalleryScroll(PATH, "", STATE, false));
    await flushFrames();
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ top: 800 }));
  });
});
