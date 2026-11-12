import { act, renderHook, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const remote = vi.hoisted(() => ({ store: new Map<string, unknown>() }));
vi.mock("@/lib/sidebarOrderSync", () => ({
  isCustomOrder: (o: { sections: string[]; projects: string[]; folders: object }) => o.sections.length > 0 || o.projects.length > 0 || Object.keys(o.folders).length > 0,
  fetchRemoteSidebarOrder: async (id: string) => remote.store.get(id) ?? null,
  saveRemoteSidebarOrder: async (id: string, order: unknown, reordered = true) => { remote.store.set(id, { order, reordered }); },
}));
import { useSidebarOrder } from "./useSidebarOrder";
import { resetSidebarOrder } from "@/lib/sidebarOrder";
beforeEach(() => { localStorage.clear(); remote.store.clear(); });
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
  it("restores the account layout in a fresh browser", async () => {
    remote.store.set("owner", { order: { sections: ["projects", "core"], projects: [], folders: {} }, reordered: true });
    const { result } = renderHook(() => useSidebarOrder("owner"));
    await waitFor(() => expect(result.current.order.sections).toEqual(["projects", "core"]));
  });
  it("migrates this browser's existing layout to the account when the account has none", async () => {
    localStorage.setItem("ma-sidebar-order-v1:owner", JSON.stringify({ sections: ["quotes", "core"], projects: [], folders: {} }));
    renderHook(() => useSidebarOrder("owner"));
    await waitFor(() => expect((remote.store.get("owner") as { order: { sections: string[] } })?.order.sections).toEqual(["quotes", "core"]));
  });
});
