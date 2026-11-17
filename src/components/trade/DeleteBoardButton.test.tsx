import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteBoardButton } from "./DeleteBoardButton";

const { remove, result } = vi.hoisted(() => ({ remove: vi.fn(), result: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ delete: remove }) } }));
const board = { id: "empty-board", title: "Mood board", project_id: "project" };
beforeEach(() => {
  vi.clearAllMocks();
  remove.mockReturnValue({ eq: vi.fn().mockReturnValue({ select: () => ({ single: result }) }) });
});
describe("folder deletion", () => {
  it("does not delete when confirmation is cancelled", () => {
    render(<DeleteBoardButton board={board} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete folder Mood board" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();
  });
  it("refreshes only after the exact folder deletion is confirmed", async () => {
    result.mockResolvedValue({ data: { id: "empty-board" }, error: null });
    const onDeleted = vi.fn();
    render(<DeleteBoardButton board={board} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete folder Mood board" }));
    fireEvent.click(screen.getByRole("button", { name: /^Delete folder$/ }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(remove.mock.results[0].value.eq).toHaveBeenCalledWith("id", "empty-board");
  });
  it("keeps the folder and confirmation when access refuses deletion", async () => {
    result.mockResolvedValue({ data: null, error: { message: "No row returned" } });
    const onDeleted = vi.fn();
    render(<DeleteBoardButton board={board} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete folder Mood board" }));
    fireEvent.click(screen.getByRole("button", { name: /^Delete folder$/ }));
    await screen.findByRole("alert");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});