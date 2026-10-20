import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SalesFunnelDeleteControl from "./SalesFunnelDeleteControl";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invalidate: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
const entry = { id: "8dfd2eae-3c9b-4dcf-911f-e8febfd679fb", source: "cart" as const, label: "Test bag", sublabel: null, email: null, createdAt: "2026-10-20", amountLabel: null, href: null, imageUrl: null };

describe("confirmed funnel deletion", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ error: null }); });
  it("does not delete when opened or cancelled", () => {
    render(<SalesFunnelDeleteControl entry={entry} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Test bag" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("deletes only the confirmed source and UUID and refreshes", async () => {
    render(<SalesFunnelDeleteControl entry={entry} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Test bag" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["sales-funnel"] }));
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("admin_delete_sales_funnel_entry", { _source: "cart", _id: entry.id });
  });
  it("keeps protected or failed entries open without reporting success", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Payment-linked records are protected" } });
    render(<SalesFunnelDeleteControl entry={entry} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Test bag" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Payment-linked records are protected"));
    expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeVisible();
  });
});