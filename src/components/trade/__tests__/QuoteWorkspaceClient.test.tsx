import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProjectWorkspaceProvider, useProjectWorkspace } from "@/contexts/ProjectWorkspaceContext";
import QuoteWorkspaceClient from "../QuoteWorkspaceClient";

const mocks = vi.hoisted(() => ({ from: vi.fn(), savedFolder: "sheet", emails: ["cdelval@ace-capital.com"], linkedClient: false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
beforeEach(() => {
  mocks.savedFolder = "sheet";
  mocks.emails = ["cdelval@ace-capital.com"];
  mocks.linkedClient = false;
  mocks.from.mockImplementation((table: string) => {
    const result = { data: table === "trade_quotes" ? { project_id: "singapore", project_board_id: mocks.savedFolder }
      : table === "client_boards" ? { project_id: "singapore", client_id: mocks.linkedClient ? "client" : null }
      : table === "projects" ? { client_id: null, client_name: "" }
      : table === "clients" ? { type: "company", name: "Alternative Capital Enterprises Pte Ltd" }
      : table === "client_contacts" ? [{ first_name: "Cyrille", last_name: "Delval", email: "cdelval@ace-capital.com", is_primary: true }]
      : table === "client_board_items" ? [] : mocks.emails.map(email => ({ email })), error: null };
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq"]) chain[method] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => result);
    chain.order = vi.fn(async () => result);
    chain.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  });
});
it("hydrates company, contact name and email together for the folder's linked client", async () => {
  mount();
  await screen.findByText("cdelval@ace-capital.com");
});
afterEach(cleanup);
let invite: ((projectId: string, folderId: string, email: string) => () => void) | undefined;
function Actions() {
  invite = useProjectWorkspace()?.submitClientInvitation;
  return null;
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ProjectWorkspaceProvider><Actions /><QuoteWorkspaceClient quoteId="quote" projectId="singapore" /></ProjectWorkspaceProvider></QueryClientProvider>);
}
it("loads the exact saved folder client and updates immediately from workspace invitations", async () => {
  mount();
  await screen.findByText("cdelval@ace-capital.com");
  act(() => { invite?.("singapore", "other-folder", "other@example.com"); });
  expect(screen.queryByText("other@example.com")).toBeNull();
  act(() => { invite?.("singapore", "sheet", "new-client@example.com"); });
  expect(screen.getByText("new-client@example.com")).toBeTruthy();
});
it("does not borrow a project-level contact when the quote folder has no client", async () => {
  mocks.emails = [];
  mount();
  act(() => { invite?.("singapore", "other-folder", "other@example.com"); });
  await waitFor(() => expect(screen.getByText("CLIENT: UNASSIGNED TO PROJECT")).toBeTruthy());
  expect(screen.queryByText("other@example.com")).toBeNull();
});