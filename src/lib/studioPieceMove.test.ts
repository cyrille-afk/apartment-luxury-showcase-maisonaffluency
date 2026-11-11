import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), eq: vi.fn(), single: vi.fn(), folders: [] as unknown[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { moveStudioPiece } from "./studioPairingFolders";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.folders = [{ id: "source", title: "Source edit" }, { id: "target", title: "Target edit" }];
  const chain = { select: () => chain, eq: mocks.eq, in: async () => ({ data: mocks.folders, error: null }), single: mocks.single, update: mocks.update, is: () => chain };
  mocks.eq.mockReturnValue(chain);
  mocks.update.mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
  mocks.single.mockResolvedValueOnce({ data: { id: "saved-row", procurement_quote_id: null, source_quote_item_id: null }, error: null })
    .mockResolvedValueOnce({ data: { id: "saved-row", board_id: "target" }, error: null });
});
it("moves the original row in place without replacing finishes, notes or feedback", async () => {
  expect(await moveStudioPiece("project", "saved-row", "source", "target")).toEqual({ id: "target", title: "Target edit" });
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ board_id: "target", subfolder: null });
  expect(mocks.eq).toHaveBeenCalledWith("project_id", "project");
  expect(mocks.eq).toHaveBeenCalledWith("id", "saved-row");
  expect(mocks.eq).toHaveBeenCalledWith("board_id", "source");
});
it("rejects another project's target without updating the saved piece", async () => {
  mocks.folders = [{ id: "source", title: "Source edit" }];
  await expect(moveStudioPiece("project", "saved-row", "source", "target")).rejects.toThrow("active project");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("does not move quote-linked saved pieces", async () => {
  mocks.single.mockReset().mockResolvedValue({ data: { id: "saved-row", source_quote_item_id: "quote-line" }, error: null });
  await expect(moveStudioPiece("project", "saved-row", "source", "target")).rejects.toThrow("linked to a quote");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("does not report a failed move as successful", async () => {
  mocks.single.mockReset().mockResolvedValueOnce({ data: { id: "saved-row" }, error: null }).mockResolvedValueOnce({ data: null, error: { message: "denied" } });
  await expect(moveStudioPiece("project", "saved-row", "source", "target")).rejects.toThrow("original folder has been kept");
});