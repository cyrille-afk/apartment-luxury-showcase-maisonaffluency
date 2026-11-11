import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), eq: vi.fn(), getUser: vi.fn(), single: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser } } }));
import { savePairingToFolder } from "./studioPairingFolders";

beforeEach(() => {
  vi.clearAllMocks();
  const chain = { select: () => chain, eq: mocks.eq, limit: () => chain, single: mocks.single, maybeSingle: mocks.maybeSingle, insert: mocks.insert };
  mocks.eq.mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
});
it("rejects a missing explicit folder without any write", async () => {
  await expect(savePairingToFolder("project", "", "gingko")).rejects.toThrow("Select a project sub-folder");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("checks the selected folder belongs to the active project before writing", async () => {
  mocks.single.mockResolvedValue({ data: null, error: { message: "not found" } });
  await expect(savePairingToFolder("project", "other-folder", "gingko")).rejects.toThrow("active project");
  expect(mocks.eq.mock.calls).toEqual([["id", "other-folder"], ["project_id", "project"]]);
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("does not duplicate a piece already saved in the selected folder", async () => {
  mocks.single.mockResolvedValue({ data: { id: "folder", title: "Selected edit" }, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { id: "existing" }, error: null });
  expect(await savePairingToFolder("project", "folder", "gingko")).toEqual({ id: "folder", title: "Selected edit" });
  expect(mocks.insert).not.toHaveBeenCalled();
});