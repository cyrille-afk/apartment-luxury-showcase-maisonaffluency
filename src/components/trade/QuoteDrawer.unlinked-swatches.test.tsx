import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import QuoteDrawer from "./QuoteDrawer";

vi.mock("./CollaboratorInviteProvider", () => ({ useCollaboratorInvite: () => vi.fn(), useCollaboratorInviteDefault: () => null }));
vi.mock("@/lib/hydrateQuotePricesFromPicks", () => ({ hydrateQuotePricesFromPicks: async (items: unknown[]) => items }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

const pickTitles = vi.hoisted(() => ({ rows: [] as { id: string; title: string }[] }));
const product = { id: "orphan", source_pick_id: null, product_name: "Frenchmen Street Lounge Chair ", brand_name: "Sebastian Herkner", rrp_price_cents: null, trade_price_cents: 501600, currency: "EUR", image_url: null, size_variants: null };
const swatches = [
  { pick_id: "lounge-pick", fabric_id: "f1", name: "Opera Calla", image_url: "https://img/calla.jpg", sort_order: 1, is_active: true },
  { pick_id: "lounge-pick", fabric_id: "f2", name: "Opera Delft", image_url: "https://img/delft.jpg", sort_order: 2, is_active: true },
];
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => ({ select: () => ({
  ilike: () => ({ limit: async () => ({ data: table === "designer_curator_picks" ? pickTitles.rows : [] }) }),
  in: () => ({ order: async () => ({ data: table === "product_fabric_swatches_public" ? swatches : [] }) }),
  or: async () => ({ data: [] }),
  eq: () => table === "trade_quotes"
    ? { maybeSingle: async () => ({ data: { status: "draft", updated_at: "2026-11-09T03:57:00Z", project_id: null } }) }
    : { order: async () => ({ data: [{ id: "line", product, quantity: 1, variant_label: "Fabric Cat. Opera", unit_price_cents: 501600, unit_price_currency: "EUR", created_at: "2026-11-09T03:57:00Z" }] }) },
}) }) } }));
afterEach(() => { cleanup(); pickTitles.rows = []; });

it("shows finish crops for a line saved against an unlinked catalogue copy when its title matches one piece", async () => {
  pickTitles.rows = [{ id: "lounge-pick", title: "Frenchmen Street Lounge Chair " }];
  render(<QuoteDrawer open onOpenChange={vi.fn()} quoteId="quote" />);
  await waitFor(() => expect(screen.getByAltText("Opera Calla")).toBeTruthy());
  expect(screen.getByAltText("Opera Delft")).toBeTruthy();
});

it("does not guess finish crops when two pieces share the title", async () => {
  pickTitles.rows = [{ id: "lounge-pick", title: "Frenchmen Street Lounge Chair" }, { id: "other", title: "frenchmen street lounge chair " }];
  render(<QuoteDrawer open onOpenChange={vi.fn()} quoteId="quote" />);
  await waitFor(() => expect(screen.getByText("Finish: Fabric Cat. Opera")).toBeTruthy());
  expect(screen.queryByAltText("Opera Calla")).toBeNull();
});
