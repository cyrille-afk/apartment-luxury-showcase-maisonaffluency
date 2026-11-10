import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), comments: [] as { id: string; comment: string; created_at: string }[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/lib/router-compat", () => ({ useParams: () => ({ token: "a".repeat(48) }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "client" } }) }));
vi.mock("react-helmet-async", () => ({ Helmet: () => null }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/components/trade/procurement/FinishesDrawer", () => ({ default: () => null, resolveFinishFrom: vi.fn() }));
vi.mock("@/components/trade/procurement/ProcurementBoardPanel", () => ({ FinishChips: () => null }));
vi.mock("@/components/trade/visualiser/SharedVisualiserScene", () => ({ default: () => null }));
vi.mock("@/components/trade/visualiser/WorkspacePresentation", () => ({ default: () => null }));
import SharedProcurementBoard from "./SharedProcurementBoard";

describe("saved client board feedback", () => {
  beforeEach(() => {
    mocks.comments = [];
    mocks.rpc.mockReset();
    mocks.rpc.mockImplementation(async (name: string, args: { _comment?: string }) => {
      if (name === "submit_board_feedback") {
        if (args._comment) mocks.comments.push({ id: "saved-comment", comment: args._comment, created_at: "2026-11-10T04:19:53Z" });
        return { error: null };
      }
      if (name === "get_shared_board") return { data: {
        board_title: "Man of Parts", studio_name: "Studio", project_name: null, role: "client", claimed: true,
        items: [{ id: "madison", product_id: "table", product_name: "Madison Avenue Side Table", currency: "EUR", approval_status: "approved", my_reaction: "up", my_comments: [...mocks.comments] }],
      } };
      return { data: null };
    });
  });
  afterEach(cleanup);
  it("reads submitted comments back and preserves them when the client reopens the board", async () => {
    const view = render(<SharedProcurementBoard />);
    await screen.findByRole("heading", { name: "Madison Avenue Side Table" });
    fireEvent.click(screen.getByRole("button", { name: "Comment", exact: true }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep my selected finishes" } });
    fireEvent.click(screen.getByRole("button", { name: "Send", exact: true }));
    await waitFor(() => expect(mocks.comments[0]?.comment).toBe("Keep my selected finishes"));
    await screen.findByText("Keep my selected finishes");
    view.unmount();
    render(<SharedProcurementBoard />);
    await screen.findByText("Keep my selected finishes");
    expect(mocks.rpc).toHaveBeenCalledWith("submit_board_feedback", expect.objectContaining({ _item_id: "madison", _comment: "Keep my selected finishes" }));
  });
  it("restores the saved approval and reaction on reopening", async () => {
    render(<SharedProcurementBoard />);
    await screen.findByRole("heading", { name: "Madison Avenue Side Table" });
    expect(screen.getByRole("button", { name: "Like" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Approved");
  });
});