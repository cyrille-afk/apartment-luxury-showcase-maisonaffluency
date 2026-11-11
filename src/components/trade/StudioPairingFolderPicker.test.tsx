import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), save: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/studioPairingFolders", () => ({ listPairingFolders: mocks.list, createPairingFolder: mocks.create, savePairingToFolder: mocks.save }));
vi.mock("sonner", () => ({ toast: { success: mocks.toast } }));
import { StudioPairingFolderPicker } from "./StudioPairingFolderPicker";

describe("Curation folder choice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ folders: [{ id: "selection", title: "Singapore GCB workflow — Selection" }, { id: "edit", title: "Man of Parts — curated edit" }], saved: new Set() });
    mocks.save.mockResolvedValue({ id: "edit", title: "Man of Parts — curated edit" });
    mocks.create.mockResolvedValue({ id: "new", title: "New curated edit" });
  });
  const mount = () => {
    const onSaved = vi.fn();
    render(<StudioPairingFolderPicker projectId="project" productId="gingko" productName="Gingko Side Table" onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Gingko Side Table to project folder" }));
    return onSaved;
  };
  it("opening + ADD does not save or refresh before a folder choice", async () => {
    const onSaved = mount();
    await screen.findByRole("button", { name: "Man of Parts — curated edit" });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("saves the explicitly chosen sub-folder and names it in the confirmation", async () => {
    const onSaved = mount();
    fireEvent.click(await screen.findByRole("button", { name: "Man of Parts — curated edit" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mocks.save).toHaveBeenCalledWith("project", "edit", "gingko");
    expect(mocks.toast).toHaveBeenCalledWith("Saved to Man of Parts — curated edit", expect.objectContaining({ description: "Gingko Side Table" }));
  });
  it("retains a created sub-folder when saving fails so retry does not create another", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Save failed")).mockResolvedValueOnce({ id: "new", title: "New curated edit" });
    const onSaved = mount();
    fireEvent.click(await screen.findByRole("button", { name: "Create New Sub-Folder" }));
    fireEvent.change(screen.getByLabelText("New sub-folder name"), { target: { value: "New curated edit" } });
    fireEvent.click(screen.getByRole("button", { name: "Create & save" }));
    await screen.findByRole("alert");
    expect(onSaved).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenLastCalledWith("project", "new", "gingko");
  });
});