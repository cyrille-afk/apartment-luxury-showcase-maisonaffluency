import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deferHashScrollUntilSheetClosed } from "@/lib/mobileHashNavigation";

/**
 * Regression test for mobile hash-link navigation.
 */

describe("Mobile hash-link navigation", () => {
  const originalRaf = window.requestAnimationFrame;

  beforeEach(() => {
    vi.useFakeTimers();
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    window.requestAnimationFrame = originalRaf;
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits for the Sheet overlay to clear before scrolling", () => {
    const overlay = document.createElement("div");
    overlay.setAttribute("data-radix-dialog-overlay", "");
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const onScroll = vi.fn();
    deferHashScrollUntilSheetClosed({ id: "designers", onScroll, closeDelayMs: 0, checkIntervalMs: 50 });

    vi.advanceTimersByTime(200);
    expect(onScroll).not.toHaveBeenCalled();

    overlay.remove();
    document.body.style.overflow = "";

    vi.advanceTimersByTime(50);
    expect(onScroll).toHaveBeenCalledWith("designers");
  });

  it("updates the hash before running the deferred section scroll", () => {
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const onScroll = vi.fn();

    deferHashScrollUntilSheetClosed({ id: "designers", onScroll, closeDelayMs: 0, checkIntervalMs: 10 });
    vi.runAllTimers();

    expect(replaceSpy).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("#designers")
    );
    expect(onScroll).toHaveBeenCalledWith("designers");
  });
});
