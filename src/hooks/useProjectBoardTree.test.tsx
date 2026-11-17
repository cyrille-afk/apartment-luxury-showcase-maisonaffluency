import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { projectDefaultUrl, useProjectBoardTree, type ProjectBoardLink } from "./useProjectBoardTree";

const mocks = vi.hoisted(() => ({ order: vi.fn(), scope: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ in: mocks.scope }) }) } }));
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