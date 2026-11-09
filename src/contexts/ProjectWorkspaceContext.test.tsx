import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProjectWorkspaceProvider, useProjectWorkspace } from "./ProjectWorkspaceContext";
import InviteCollaboratorDialog from "@/components/trade/procurement/InviteCollaboratorDialog";
import ProjectWorkspaceContact from "@/components/trade/ProjectWorkspaceContact";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); mocks.invoke.mockResolvedValue({ error: null }); });
afterEach(cleanup);
function State() {
  const workspace = useProjectWorkspace();
  return <output data-testid="state">{JSON.stringify(workspace?.projects)}</output>;
}
function mount() {
  return render(<ProjectWorkspaceProvider><State /><h1>Singapore GCB workflow</h1><ProjectWorkspaceContact projectId="singapore" folderId="folder-two" /><InviteCollaboratorDialog open boardId="" projectId="singapore" boardOptions={[{ id: "folder-one", title: "First folder" }, { id: "folder-two", title: "Second folder" }]} clientWorkspace workspaceInvite onOpenChange={() => {}} onInvited={() => {}} /></ProjectWorkspaceProvider>);
}
function submit(email = "client@example.com") {
  fireEvent.change(screen.getByLabelText("Project folder"), { target: { value: "folder-two" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
}
const state = () => JSON.parse(screen.getByTestId("state").textContent || "{}");

it("updates primaryContact and collaborators in only the selected folder immediately, before the invitation response", () => {
  mocks.rpc.mockReturnValue(new Promise(() => {}));
  mount(); submit();
  expect(state()).toEqual({ singapore: { primaryContact: "client@example.com", collaborators: ["client@example.com"], folders: { "folder-two": { primaryContact: "client@example.com", collaborators: ["client@example.com"] } } } });
  expect(screen.getByText(/Client workspace owner/).textContent).toContain("client@example.com");
});
it("rolls back a rejected invitation without retaining a false client contact", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "rejected" } });
  mount(); submit();
  await waitFor(() => expect(state()).toEqual({}));
  expect(screen.queryByText(/Client workspace owner/)).toBeNull();
});
it("invalid email submissions do not update the folder", () => {
  mount(); submit("invalid");
  expect(state()).toEqual({});
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("retains a created invite's contact when email delivery fails", async () => {
  mocks.rpc.mockResolvedValue({ data: { id: "invite", token: "token" }, error: null });
  mocks.invoke.mockResolvedValue({ error: { message: "delivery failed" } });
  mount(); submit();
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalled());
  expect(state().singapore.folders["folder-two"].primaryContact).toBe("client@example.com");
});
it("deduplicates collaborators and preserves newer contact updates when an older request rolls back", () => {
  function Actions() {
    const workspace = useProjectWorkspace();
    return <button onClick={() => {
      const rollback = workspace?.submitClientInvitation("singapore", "folder", "old@example.com");
      workspace?.submitClientInvitation("singapore", "folder", "new@example.com");
      workspace?.submitClientInvitation("singapore", "folder", "NEW@example.com");
      workspace?.submitClientInvitation("other", "other-folder", "other@example.com");
      rollback?.();
    }}>Update</button>;
  }
  render(<ProjectWorkspaceProvider><State /><Actions /></ProjectWorkspaceProvider>);
  fireEvent.click(screen.getByText("Update"));
  expect(state().singapore).toEqual({ primaryContact: "NEW@example.com", collaborators: ["new@example.com"], folders: { folder: { primaryContact: "NEW@example.com", collaborators: ["new@example.com"] } } });
  expect(state().other.primaryContact).toBe("other@example.com");
});