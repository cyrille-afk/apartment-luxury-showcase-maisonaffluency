import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollaboratorInviteProvider } from "./CollaboratorInviteProvider";
import QuoteWorkspaceInvite from "./QuoteWorkspaceInvite";
const state = vi.hoisted(() => ({ search: "?project=other", project: { id: "singapore", name: "Singapore GCB workflow" }, boards: [{ id: "folder", project_id: "singapore", title: "Singapore GCB workflow" }] }));
vi.mock("@/lib/router-compat", () => ({ useLocation: () => ({ search: state.search }) }));
vi.mock("@/hooks/useProjects", () => ({ useProject: () => ({ project: state.project, loading: false }) }));
vi.mock("@/hooks/useUserBoards", () => ({ useUserBoards: () => ({ boards: state.boards, loading: false, error: null }) }));
vi.mock("./procurement/InviteCollaboratorDialog", () => ({ default: (props: { projectId: string; boardId: string; clientWorkspace: boolean; onOpenChange: (open: boolean) => void }) => <div data-testid="invite" data-project={props.projectId} data-board={props.boardId} data-client={String(props.clientWorkspace)} onClick={() => props.onOpenChange(false)} /> }));
beforeEach(() => { state.search = "?project=other"; sessionStorage.clear(); });
afterEach(cleanup);
it("uses the quote project over an unrelated active filter and automatically selects its named folder", () => {
  render(<CollaboratorInviteProvider><QuoteWorkspaceInvite projectId="singapore" /></CollaboratorInviteProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Add Client to Project" }));
  const invite = screen.getByTestId("invite");
  expect(invite.getAttribute("data-project")).toBe("singapore");
  expect(invite.getAttribute("data-board")).toBe("folder");
  expect(invite.getAttribute("data-client")).toBe("true");
  fireEvent.click(invite);
  expect(screen.queryByTestId("invite")).toBeNull();
});
it("uses the selected workspace for an unassigned quote", () => {
  state.search = "?project=singapore";
  render(<CollaboratorInviteProvider><QuoteWorkspaceInvite projectId={null} /></CollaboratorInviteProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Add Client to Project" }));
  expect(screen.getByTestId("invite").getAttribute("data-project")).toBe("singapore");
});
it("restores the active folder at click time when it is absent from the URL", () => {
  state.search = "";
  render(<CollaboratorInviteProvider><QuoteWorkspaceInvite projectId={null} /></CollaboratorInviteProvider>);
  sessionStorage.setItem("trade:lastProjectFilter", "singapore");
  fireEvent.click(screen.getByRole("button", { name: "Add Client to Project" }));
  expect(screen.getByTestId("invite").getAttribute("data-project")).toBe("singapore");
});