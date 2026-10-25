import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import ResendBoardInvitation from "./ResendBoardInvitation";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
const invite = { id: "expired", email: "designer@example.com", status: "accepted", expires_at: "2026-10-24T00:00:00Z", last_seen_at: null, view_only: true, role: "client" };
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { id: "replacement", token: "fresh-token", email: invite.email }, error: null }); mocks.invoke.mockResolvedValue({ error: null }); });
it("renews only the selected project board invite and emails the returned recipient", async () => {
  const refresh = vi.fn();
  render(<ResendBoardInvitation projectId="project" boardId="board" invite={invite} now={Date.parse("2026-10-25T00:00:00Z")} onRenewed={refresh} />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(mocks.rpc).toHaveBeenCalledWith("resend_expired_project_board_invite", { _project_id: "project", _board_id: "board", _invite_id: "expired" });
  expect(mocks.invoke).toHaveBeenCalledWith("send-transactional-email", { body: { templateName: "board-collaborator-invite", recipientEmail: invite.email, idempotencyKey: "board-invite-replacement", templateData: { token: "fresh-token" } } });
});
it("retries a failed email with the same invitation rather than granting access twice", async () => {
  mocks.invoke.mockResolvedValueOnce({ error: new Error("failed") });
  render(<ResendBoardInvitation projectId="project" boardId="board" invite={invite} now={Date.parse("2026-10-25T00:00:00Z")} onRenewed={() => {}} />);
  fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("button", { name: "Retry invitation email for designer@example.com" });
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
  expect(mocks.rpc).toHaveBeenCalledOnce();
  expect(mocks.invoke.mock.calls[1]).toEqual(mocks.invoke.mock.calls[0]);
});
it("does not email when renewal is refused", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: new Error("not allowed") });
  const refresh = vi.fn();
  render(<ResendBoardInvitation projectId="project" boardId="board" invite={invite} now={Date.parse("2026-10-25T00:00:00Z")} onRenewed={refresh} />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(mocks.invoke).not.toHaveBeenCalled();
});