import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import InviteCollaboratorDialog from "./InviteCollaboratorDialog";
import { ProjectWorkspaceProvider, useProjectWorkspace } from "@/contexts/ProjectWorkspaceContext";
import { useEffect } from "react";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { id: "invite", token: "token" }, error: null }); mocks.invoke.mockResolvedValue({ error: null }); });
afterEach(cleanup);
it("atomically links quote products to the explicitly selected folder when inviting its client", async () => {
  render(<InviteCollaboratorDialog open onOpenChange={() => {}} boardId="" projectId="singapore" quoteId="quote-two-products" boardOptions={options} workspaceInvite clientWorkspace readOnly onInvited={() => {}} />);
  fireEvent.change(screen.getByLabelText("Project folder"), { target: { value: "board-two" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("create_quote_project_client_invite", { _quote_id: "quote-two-products", _project_id: "singapore", _board_id: "board-two", _email: "client@example.com" }));
  expect(mocks.rpc).not.toHaveBeenCalledWith("create_project_board_client_invite", expect.anything());
});
function ActiveFolder({ folderId = "board-two", projectId = "bangkok" }) {
  const setActiveFolder = useProjectWorkspace()?.setActiveFolder;
  useEffect(() => {
    setActiveFolder?.({ projectId, folderId });
    return () => setActiveFolder?.(null);
  }, [folderId, projectId, setActiveFolder]);
  return null;
}
const options = [{ id: "board-one", title: "First board" }, { id: "board-two", title: "Second board" }];
const dialog = (open = true, boards = options) => <InviteCollaboratorDialog open={open} onOpenChange={() => {}} boardId="" projectId="bangkok" boardOptions={boards} workspaceInvite clientWorkspace readOnly onInvited={() => {}} />;
it("clears a selected folder when the invitation project changes", () => {
  const props = { open: true, onOpenChange: () => {}, boardId: "", onInvited: () => {}, workspaceInvite: true, clientWorkspace: true, projectOptions: [{ id: "bangkok", name: "Bangkok" }, { id: "singapore", name: "Singapore GCB workflow" }] };
  const view = render(<InviteCollaboratorDialog {...props} projectId="bangkok" selectedProjectId="bangkok" boardOptions={options} />);
  fireEvent.change(screen.getByLabelText("Project folder"), { target: { value: "board-two" } });
  view.rerender(<InviteCollaboratorDialog {...props} projectId="singapore" selectedProjectId="singapore" boardOptions={options} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("submits to the active folder once asynchronously loaded choices arrive", async () => {
  const view = render(<ProjectWorkspaceProvider><ActiveFolder />{dialog(true, [])}</ProjectWorkspaceProvider>);
  view.rerender(<ProjectWorkspaceProvider><ActiveFolder />{dialog()}</ProjectWorkspaceProvider>);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("create_project_board_client_invite", { _project_id: "bangkok", _board_id: "board-two", _email: "client@example.com" }));
});
it("keeps the placeholder with no active context even for a single available folder", () => {
  render(<ProjectWorkspaceProvider>{dialog(true, [options[0]])}</ProjectWorkspaceProvider>);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("does not default to an active folder belonging to another project", () => {
  render(<ProjectWorkspaceProvider><ActiveFolder projectId="singapore" />{dialog()}</ProjectWorkspaceProvider>);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("preserves an explicit selection while open and returns to the active folder on reopen", () => {
  const view = render(<ProjectWorkspaceProvider><ActiveFolder />{dialog()}</ProjectWorkspaceProvider>);
  fireEvent.change(screen.getByLabelText("Project folder"), { target: { value: "board-one" } });
  view.rerender(<ProjectWorkspaceProvider><ActiveFolder />{dialog()}</ProjectWorkspaceProvider>);
  expect((screen.getByLabelText("Project folder") as HTMLSelectElement).value).toBe("board-one");
  view.rerender(<ProjectWorkspaceProvider><ActiveFolder />{dialog(false)}</ProjectWorkspaceProvider>);
  view.rerender(<ProjectWorkspaceProvider><ActiveFolder />{dialog()}</ProjectWorkspaceProvider>);
  expect((screen.getByLabelText("Project folder") as HTMLSelectElement).value).toBe("board-two");
});
it("respects an explicit placeholder selection rather than reapplying the default", () => {
  render(<ProjectWorkspaceProvider><ActiveFolder />{dialog()}</ProjectWorkspaceProvider>);
  fireEvent.change(screen.getByLabelText("Project folder"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("creates view-only invitations through the selected project and board", async () => {
  render(<InviteCollaboratorDialog open onOpenChange={() => {}} boardId="board-bangkok" projectId="bangkok" readOnly onInvited={() => {}} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "architect@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("create_project_board_view_invite", { _project_id: "bangkok", _board_id: "board-bangkok", _email: "architect@example.com" }));
  expect(mocks.rpc).not.toHaveBeenCalledWith("create_board_invite", expect.anything());
});
it("invites only to the explicitly selected board in the quote project", async () => {
  render(<InviteCollaboratorDialog open onOpenChange={() => {}} boardId="" projectId="bangkok" boardOptions={[{ id: "board-one", title: "First board" }, { id: "board-two", title: "Second board" }]} workspaceInvite readOnly onInvited={() => {}} />);
  expect(screen.getByRole("button", { name: "Send Invite" }).hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Project board"), { target: { value: "board-two" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("create_project_board_view_invite", { _project_id: "bangkok", _board_id: "board-two", _email: "client@example.com" }));
});
it("uses the scoped client permission path for a workspace invitation, not the view-only path", async () => {
  render(<InviteCollaboratorDialog open onOpenChange={() => {}} boardId="singapore-folder" projectId="singapore" projectName="Singapore GCB workflow" boardOptions={[{ id: "singapore-folder", title: "Singapore GCB workflow" }]} workspaceInvite clientWorkspace readOnly onInvited={() => {}} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("create_project_board_client_invite", { _project_id: "singapore", _board_id: "singapore-folder", _email: "client@example.com" }));
  expect(mocks.rpc).not.toHaveBeenCalledWith("create_project_board_view_invite", expect.anything());
  expect(mocks.rpc).not.toHaveBeenCalledWith("create_board_invite", expect.anything());
});
it("does not submit stale folder selections while project folders are loading", () => {
  render(<InviteCollaboratorDialog open onOpenChange={() => {}} boardId="singapore-folder" projectId="singapore" boardsLoading workspaceInvite clientWorkspace readOnly onInvited={() => {}} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  expect(mocks.rpc).not.toHaveBeenCalled();
});