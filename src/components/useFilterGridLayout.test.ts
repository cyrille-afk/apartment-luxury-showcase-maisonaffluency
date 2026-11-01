import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFilterGridLayout } from "./useFilterGridLayout";

describe("filter grid layout", () => {
  it("starts closed with three columns", () => {
    const { result } = renderHook(() => useFilterGridLayout());
    expect(result.current.open).toBe(false);
    expect(result.current.columns).toBe(3);
  });
  it("opens with four columns", () => {
    const { result } = renderHook(() => useFilterGridLayout());
    act(() => result.current.changeOpen(true));
    expect(result.current.open).toBe(true);
    expect(result.current.columns).toBe(4);
  });
  it("closes back to three columns", () => {
    const { result } = renderHook(() => useFilterGridLayout());
    act(() => result.current.changeOpen(true));
    act(() => result.current.changeOpen(false));
    expect(result.current.open).toBe(false);
    expect(result.current.columns).toBe(3);
  });
});