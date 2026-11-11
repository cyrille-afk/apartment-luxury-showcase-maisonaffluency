import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSidebarOrder } from "./useSidebarOrder";
import { resetSidebarOrder } from "@/lib/sidebarOrder";
beforeEach(() => localStorage.clear());
afterEach(cleanup);
describe("sidebar reorder discovery preference", () => {
  it("shows the tip until a completed reorder and keeps it dismissed after reload and reset", () => {
    const first = renderHook(() => useSidebarOrder("owner"));
    expect(first.result.current.showReorderTip).toBe(true);
    act(() => first.result.current.update({ sections: ["tools", "core", "quotes", "projects"] }));
    expect(first.result.current.showReorderTip).toBe(false);
    first.unmount();
    const reloaded = renderHook(() => useSidebarOrder("owner"));
    expect(reloaded.result.current.showReorderTip).toBe(false);
    act(() => resetSidebarOrder("owner"));
    expect(reloaded.result.current.showReorderTip).toBe(false);
  });
  it("does not dismiss another account's tip", () => {
    const { result, rerender } = renderHook(({ user }) => useSidebarOrder(user), { initialProps: { user: "first" } });
    act(() => result.current.update({ projects: ["project-b", "project-a"] }));
    rerender({ user: "second" });
    expect(result.current.showReorderTip).toBe(true);
    rerender({ user: "first" });
    expect(result.current.showReorderTip).toBe(false);
  });
});