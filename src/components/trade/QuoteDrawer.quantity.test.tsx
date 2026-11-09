import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import QuoteDrawer from "./QuoteDrawer";
import { setClientSafeMode } from "@/lib/clientSafeMode";

const state = vi.hoisted(() => ({ quantity: 2, fail: false, update: vi.fn() }));
vi.mock("./CollaboratorInviteProvider", () => ({ useCollaboratorInvite: () => vi.fn(), useCollaboratorInviteDefault: () => null }));
vi.mock("@/lib/hydrateQuotePricesFromPicks", () => ({ hydrateQuotePricesFromPicks: async (items: unknown[]) => items }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => ({
  select: () => ({ eq: () => table === "trade_quotes" ? { maybeSingle: async () => ({ data: { status: "draft" } }) } : { order: async () => ({ data: [
    { id: "chair", quantity: state.quantity, unit_price_cents: 501600, unit_price_currency: "EUR", product: { product_name: "Frenchmen Street Lounge Chair", brand_name: "Herkner", currency: "EUR" } },
    { id: "yoma", quantity: 1, unit_price_cents: 10056330, unit_price_currency: "EUR", product: { product_name: "Yoma CLW Console", brand_name: "Kerstens", currency: "EUR" } },
  ] }) }, ilike: () => ({ limit: async () => ({ data: [] }) }), or: async () => ({ data: [] }) }),
  update: (patch: { quantity: number }) => {
    state.update(patch);
    const query = { eq: () => query, select: () => ({ single: async () => {
      if (state.fail) return { data: null, error: { message: "denied" } };
      state.quantity = patch.quantity;
      return { data: { id: "chair", quantity: state.quantity }, error: null };
    } }) };
    return query;
  },
}) } }));
beforeEach(() => { state.quantity = 2; state.fail = false; state.update.mockClear(); setClientSafeMode(false); });
afterEach(cleanup);

it("reduces chair quantity from 2 to 1 without deleting it and includes Yoma in the total", async () => {
  const view = render(<QuoteDrawer open onOpenChange={vi.fn()} quoteId="quote" />);
  await screen.findByText("3 units total");
  expect(screen.getByText("€110,595")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Decrease quantity for Frenchmen Street Lounge Chair" }));
  await screen.findByText("2 units total");
  expect(state.update).toHaveBeenCalledWith({ quantity: 1 });
  expect(screen.getByText("€105,579")).toBeTruthy();
  expect(screen.getByText("2 product lines")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Decrease quantity for Frenchmen Street Lounge Chair" }).hasAttribute("disabled")).toBe(true);
  view.unmount();
  render(<QuoteDrawer open onOpenChange={vi.fn()} quoteId="quote" />);
  await screen.findByText("2 units total");
});

it("keeps the saved quantity and total when a quantity save fails", async () => {
  state.fail = true;
  render(<QuoteDrawer open onOpenChange={vi.fn()} quoteId="quote" />);
  await screen.findByText("3 units total");
  fireEvent.click(screen.getByRole("button", { name: "Decrease quantity for Frenchmen Street Lounge Chair" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByText("Qty: 2")).toBeTruthy();
  expect(screen.getByText("3 units total")).toBeTruthy();
});