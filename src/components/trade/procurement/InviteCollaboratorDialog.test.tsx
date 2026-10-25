import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import InviteCollaboratorDialog from "./InviteCollaboratorDialog";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { id: "invite", token: "token" }, error: null }); mocks.invoke.mockResolvedValue({ error: null }); });
it("creates view-only invitations through the selected project and board", async () => {
  render(<InviteCollaboratorDialog open onOpenChange={() => {}} boardId="board-bangkok" projectId="bangkok" readOnly onInvited={() => {}} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "architect@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("create_project_board_view_invite", { _project_id: "bangkok", _board_id: "board-bangkok", _email: "architect@example.com" }));
  expect(mocks.rpc).not.toHaveBeenCalledWith("create_board_invite", expect.anything());
});