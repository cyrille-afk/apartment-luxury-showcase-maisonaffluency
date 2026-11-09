import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useUserBoards } from "./useUserBoards";
const mocks = vi.hoisted(() => ({ eq: vi.fn(), getSession: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: mocks.getSession }, from: mocks.from } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "owner" } } } });
  const query = { select: () => query, eq: mocks.eq, order: () => query, limit: () => query, then: (resolve: (result: { data: never[]; error: null }) => void) => Promise.resolve({ data: [], error: null }).then(resolve) };
  mocks.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
});
afterEach(cleanup);
it("includes accessible studio folders in the selected invitation project without an owner restriction", async () => {
  const { result } = renderHook(() => useUserBoards(true, "singapore", true));
  await waitFor(() => expect(mocks.eq).toHaveBeenCalledWith("project_id", "singapore"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mocks.eq).not.toHaveBeenCalledWith("user_id", "owner");
});
it("keeps ordinary sourcing boards owner-scoped", async () => {
  renderHook(() => useUserBoards(true, "singapore"));
  await waitFor(() => expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner"));
  expect(mocks.eq).toHaveBeenCalledWith("project_id", "singapore");
});
it("never requests an unrestricted list without a project", async () => {
  renderHook(() => useUserBoards(true, null, true));
  await waitFor(() => expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner"));
});