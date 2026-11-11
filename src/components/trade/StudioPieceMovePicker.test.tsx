import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn(), move: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/studioPairingFolders", () => ({ listPairingFolders: mocks.list, moveStudioPiece: mocks.move }));
vi.mock("sonner", () => ({ toast: { success: mocks.toast } }));
import { StudioPieceMovePicker } from "./StudioPieceMovePicker";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ folders: [{ id: "source", title: "Source edit" }, { id: "target", title: "Target edit" }] });
  mocks.move.mockResolvedValue({ id: "target", title: "Target edit" });
});
it("waits for an explicit destination before moving and refreshing both views", async () => {
  const onMoved = vi.fn();
  render(<StudioPieceMovePicker projectId="project" productId="piece" productName="Gingko" placements={[{ itemId: "row", folderId: "source", folderTitle: "Source edit", finish: "Oak", locked: false }]} onMoved={onMoved} />);
  fireEvent.click(screen.getByRole("button", { name: "Move Gingko to another sub-folder" }));
  const target = await screen.findByRole("button", { name: "Target edit" });
  expect(mocks.move).not.toHaveBeenCalled();
  expect(onMoved).not.toHaveBeenCalled();
  fireEvent.click(target);
  await waitFor(() => expect(onMoved).toHaveBeenCalledTimes(1));
  expect(mocks.move).toHaveBeenCalledWith("project", "row", "source", "target");
  expect(mocks.toast).toHaveBeenCalledWith("Moved to Target edit", expect.objectContaining({ description: "Gingko" }));
});