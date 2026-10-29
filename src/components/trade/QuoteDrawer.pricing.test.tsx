import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setClientSafeMode } from "@/lib/clientSafeMode";
import QuoteDrawer from "./QuoteDrawer";

const product = { id: "sofa", source_pick_id: null, product_name: "Saint Honoré Sofa", brand_name: "Pierre Augustin Rose", rrp_price_cents: 1460000, trade_price_cents: 1460000, currency: "EUR", image_url: null,
  size_variants: [
    { base: "Solid Oak", top: "COM", label: "Saint Honoré 240", price_cents: 1460000 },
    { base: "Solid Oak", top: "Selected Pierre Frey fabric", label: "Saint Honoré 240", price_cents: 2050000 },
    { base: "Solid Oak", top: "COM", label: "Saint Honoré 280", price_cents: 1670000 },
    { base: "Solid Oak", top: "Selected Pierre Frey fabric", label: "Saint Honoré 280", price_cents: 2260000 },
  ] };
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => ({ select: () => ({ eq: () => table === "trade_quotes"
  ? { maybeSingle: async () => ({ data: { status: "draft", updated_at: "2026-10-29T08:00:00Z" } }) }
  : { order: async () => ({ data: [
  { id: "240", product, quantity: 7, variant_label: "Selected Pierre Frey fabric · Saint Honoré 240", unit_price_cents: 1845000, unit_price_currency: "EUR", created_at: "2026-10-28T09:00:00Z" },
  { id: "280", product, quantity: 1, variant_label: "Selected Pierre Frey fabric · Saint Honoré 280", fabric_id: "teddy", fabric: { name: "Teddy Mohair", price_per_lm_cents: null }, unit_price_cents: 2034000, unit_price_currency: "EUR", created_at: "2026-10-29T10:00:00Z" },
] }) } }) }) } }));
vi.mock("@/lib/hydrateQuotePricesFromPicks", () => ({ hydrateQuotePricesFromPicks: async (items: unknown[]) => items }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children, params, onClick }: { children: React.ReactNode; params: { quoteId: string }; onClick: () => void }) => <a href={`/trade/quotes/${encodeURIComponent(params.quoteId)}`} onClick={onClick}>{children}</a> }));
afterEach(() => { cleanup(); setClientSafeMode(false); });

it("opens the exact active quote without treating unit quantity as separate lines", async () => {
  const onOpenChange = vi.fn();
  render(<QuoteDrawer open onOpenChange={onOpenChange} quoteId="e3ccd6-active-quote" />);
  await waitFor(() => expect(screen.getAllByText("€22,600").length).toBeGreaterThan(0));
  const link = screen.getByRole("link", { name: "Open Quote Builder" });
  expect(link.getAttribute("href")).toBe("/trade/quotes/e3ccd6-active-quote");
  expect(screen.getByText("2 line items · 8 units in this quote")).toBeTruthy();
  expect(screen.getByText("Qty: 7")).toBeTruthy();
  fireEvent.click(link);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("shows unit price and line total per line plus a quote summary", async () => {
  render(<QuoteDrawer open onOpenChange={vi.fn()} quoteId="quote" />);
  await waitFor(() => expect(screen.getByTestId("quote-summary")).toBeTruthy());
  // Line 1: 7 × €18,450 net = €129,150; Line 2: 1 × €20,340 net.
  expect(screen.getByText("€129,150")).toBeTruthy();
  expect(screen.getAllByText("Unit price")).toHaveLength(2);
  expect(screen.getByText("Line total · 7 units")).toBeTruthy();
  // Summary: 2 product lines, 8 units, net total €149,490.
  expect(screen.getByText("2 product lines")).toBeTruthy();
  expect(screen.getByText("8 units total")).toBeTruthy();
  expect(screen.getByText("€149,490")).toBeTruthy();
});

it("restores saved configured retail across every quote line without an active page snapshot", async () => {
  setClientSafeMode(false);
  render(<QuoteDrawer open onOpenChange={vi.fn()} quoteId="quote" />);
  await waitFor(() => expect(screen.getAllByText("€22,600").length).toBeGreaterThan(0));
  expect(screen.getAllByText("€20,500").length).toBeGreaterThan(0);
  expect(screen.getAllByText("€20,340").length).toBeGreaterThan(0);
  expect(screen.getAllByText("€18,450").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("switch", { name: "Presentation Mode" }));
  expect(screen.queryByText("€20,340")).toBeNull();
  expect(screen.queryByText("€18,450")).toBeNull();
  expect(screen.queryByText("€129,150")).toBeNull();
  expect(screen.getAllByText("€22,600").length).toBeGreaterThan(0);
  expect(screen.getAllByText("€20,500").length).toBeGreaterThan(0);
  // Presentation summary: 7 × €20,500 + 1 × €22,600 = €166,100 retail.
  expect(screen.getByText("€166,100")).toBeTruthy();
  expect(screen.getByText("Retail total")).toBeTruthy();
});

it("keeps the live active-line retail snapshot ahead of catalogue retail", async () => {
  setClientSafeMode(true);
  render(<QuoteDrawer open onOpenChange={vi.fn()} quoteId="quote" activePriceSnapshot={{ itemId: "280", retailLabel: "€23,000", netLabel: "€20,700" }} />);
  await waitFor(() => expect(screen.getByText("€23,000")).toBeTruthy());
  expect(screen.queryByText("€20,700")).toBeNull();
  expect(screen.getAllByText("€20,500").length).toBeGreaterThan(0);
});