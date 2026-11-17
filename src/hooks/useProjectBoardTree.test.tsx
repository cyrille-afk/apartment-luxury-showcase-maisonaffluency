import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { projectDefaultUrl, useProjectBoardTree, type ProjectBoardLink } from "./useProjectBoardTree";

const mocks = vi.hoisted(() => ({ order: vi.fn(), scope: vi.fn(), finishes: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => ({ select: () => ({ in: table === "project_studio_finishes" ? mocks.finishes : mocks.scope }) }) } }));
const board = { id: "deleted-folder", project_id: "project", title: "Mood board", updated_at: "2026-11-17" };
const remaining = { ...board, id: "remaining-folder" };
type Result = { data: ProjectBoardLink[]; error: null };
function deferred() {
  let resolve: (value: Result) => void = () => {};
  const promise = new Promise<Result>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.scope.mockReturnValue({ order: mocks.order });
  mocks.finishes.mockResolvedValue({ data: [], error: null });
  mocks.order.mockResolvedValue({ data: [board, remaining], error: null });
});
afterEach(cleanup);

it("removes the confirmed deleted folder immediately while reloading every mounted tree", async () => {
  const first = renderHook(() => useProjectBoardTree(["project"]));
  const second = renderHook(() => useProjectBoardTree(["project"]));
  await waitFor(() => expect(first.result.current).toHaveLength(2));
  await waitFor(() => expect(second.result.current).toHaveLength(2));
  const refresh = deferred();
  mocks.order.mockReturnValue(refresh.promise);
  act(() => window.dispatchEvent(new CustomEvent("concierge:artifacts-changed", { detail: { deletedBoardId: board.id } })));
  expect(first.result.current).toEqual([remaining]);
  expect(second.result.current).toEqual([remaining]);
  expect(projectDefaultUrl("project", first.result.current)).toContain(remaining.id);
  expect(mocks.scope).toHaveBeenLastCalledWith("project_id", ["project"]);
  await act(async () => refresh.resolve({ data: [remaining], error: null }));
});

it("does not resurrect a deleted folder from a slower pre-deletion request", async () => {
  const stale = deferred();
  const fresh = deferred();
  mocks.order.mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise);
  const { result } = renderHook(() => useProjectBoardTree(["project"]));
  act(() => window.dispatchEvent(new CustomEvent("concierge:artifacts-changed", { detail: { deletedBoardId: board.id } })));
  await act(async () => fresh.resolve({ data: [remaining], error: null }));
  await act(async () => stale.resolve({ data: [board, remaining], error: null }));
  expect(result.current).toEqual([remaining]);
});

it("refreshes ordinary artifact changes and removes its listener on unmount", async () => {
  const { result, unmount } = renderHook(() => useProjectBoardTree(["project"]));
  await waitFor(() => expect(result.current).toHaveLength(2));
  mocks.order.mockResolvedValue({ data: [], error: null });
  act(() => window.dispatchEvent(new Event("concierge:artifacts-changed")));
  await waitFor(() => expect(result.current).toEqual([]));
  expect(projectDefaultUrl("project", result.current)).toBe("/trade/projects/project");
  unmount();
  const calls = mocks.order.mock.calls.length;
  window.dispatchEvent(new Event("concierge:artifacts-changed"));
  expect(mocks.order).toHaveBeenCalledTimes(calls);
});

it("reads saved item counts without dropping empty folders from the shared tree", async () => {
  mocks.order.mockResolvedValue({ data: [{ ...board, client_board_items: [] }, { ...remaining, client_board_items: Array.from({ length: 8 }, (_, i) => ({ id: `item-${i}`, product_id: `product-${i}` })) }], error: null });
  const { result } = renderHook(() => useProjectBoardTree(["project"]));
  await waitFor(() => expect(result.current).toHaveLength(2));
  expect(result.current.map(folder => folder.item_count)).toEqual([0, 8]);
});

it("refreshes eight to six after confirmed Studio exclusions, including remount", async () => {
  mocks.order.mockResolvedValue({ data: [{ ...board, client_board_items: Array.from({ length: 8 }, (_, i) => ({ id: `item-${i}`, product_id: `product-${i}` })) }], error: null });
  const { result, unmount } = renderHook(() => useProjectBoardTree(["project"]));
  await waitFor(() => expect(result.current[0]?.item_count).toBe(8));
  mocks.finishes.mockResolvedValue({ data: [0, 1].map(i => ({ project_id: "project", item_key: `item-${i}`, selection: { excluded: true } })), error: null });
  act(() => window.dispatchEvent(new Event("concierge:artifacts-changed")));
  await waitFor(() => expect(result.current[0]?.item_count).toBe(6));
  unmount();
  const restored = renderHook(() => useProjectBoardTree(["project"]));
  await waitFor(() => expect(restored.result.current[0]?.item_count).toBe(6));
});