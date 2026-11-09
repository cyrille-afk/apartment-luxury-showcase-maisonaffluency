import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import InviteCollaboratorDialog from "./InviteCollaboratorDialog";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { id: "invite", token: "token" }, error: null }); mocks.invoke.mockResolvedValue({ error: null }); });
afterEach(cleanup);
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