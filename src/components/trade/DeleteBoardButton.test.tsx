import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteBoardButton } from "./DeleteBoardButton";

const { remove, result, count } = vi.hoisted(() => ({ remove: vi.fn(), result: vi.fn(), count: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ delete: remove, select: () => ({ eq: count }) }) } }));
const board = { id: "empty-board", title: "Mood board", project_id: "project" };
beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue({ count: 11, error: null });
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
    const dispatch = vi.spyOn(window, "dispatchEvent");
    render(<DeleteBoardButton board={board} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete folder Mood board" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Delete folder$/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /^Delete folder$/ }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(remove.mock.results[0].value.eq).toHaveBeenCalledWith("id", "empty-board");
    const event = dispatch.mock.calls.find(([event]) => event.type === "concierge:artifacts-changed")?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).detail).toEqual({ deletedBoardId: "empty-board" });
    dispatch.mockRestore();
  });
  it("keeps the folder and confirmation when access refuses deletion", async () => {
    result.mockResolvedValue({ data: null, error: { message: "No row returned" } });
    const onDeleted = vi.fn();
    render(<DeleteBoardButton board={board} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete folder Mood board" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Delete folder$/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /^Delete folder$/ }));
    await screen.findByRole("alert");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
it("checks the exact folder and blocks deletion when its contents cannot be counted", async () => {
  count.mockResolvedValue({ count: null, error: { message: "unavailable" } });
  render(<DeleteBoardButton board={board} onDeleted={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete folder Mood board" }));
  await screen.findByRole("alert");
  expect(count).toHaveBeenCalledWith("board_id", "empty-board");
  expect(screen.getByRole("button", { name: /^Delete folder$/ })).toBeDisabled();
  expect(remove).not.toHaveBeenCalled();
});