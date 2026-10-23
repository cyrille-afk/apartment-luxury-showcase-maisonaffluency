import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_TRADE_TOUR_QUERY, useDesktopTradeTour } from "./useDesktopTradeTour";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Trade walkthrough device gate", () => {
  it("blocks mobile walkthroughs", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
    const { result } = renderHook(useDesktopTradeTour);
    expect(result.current).toBe(false);
  });
  it("allows desktop replay and closes when the device becomes mobile", () => {
    let sync = () => {};
    const media = { matches: true, media: DESKTOP_TRADE_TOUR_QUERY, addEventListener: vi.fn((_event, listener) => { sync = listener; }), removeEventListener: vi.fn() };
    vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
    const { result } = renderHook(useDesktopTradeTour);
    expect(result.current).toBe(true);
    act(() => { media.matches = false; sync(); });
    expect(result.current).toBe(false);
  });
});