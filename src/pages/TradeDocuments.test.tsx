import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), track: vi.fn(), carousel: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const chain = { select: () => chain, order: () => chain, eq: () => chain,
    then: (resolve: (value: unknown) => void) => resolve(table === "trade_documents" ? mocks.query() : { data: [], error: null }) };
  return chain;
} } }));
vi.mock("@/lib/trackDownload", () => ({ trackDownload: mocks.track }));
vi.mock("react-helmet-async", () => ({ Helmet: () => null }));
vi.mock("@/lib/router-compat", () => ({ Link: () => null, useSearchParams: () => [new URLSearchParams(), vi.fn()] }));
vi.mock("@/components/trade/ToolsBreadcrumb", () => ({ useToolsBreadcrumbExtras: () => {} }));
vi.mock("@/components/trade/SectionHero", () => ({ default: () => null }));
vi.mock("@/components/trade/BrandCarousel", () => ({ default: (props: unknown) => { mocks.carousel(props); return null; } }));
vi.mock("@/lib/priceListStorage", () => ({ isPrivateFileUrl: () => false, signPriceListUrl: vi.fn() }));
import TradeDocuments from "./TradeDocuments";

const document = { id: "delcourt", title: "Delcourt Collection Catalogue 2026", brand_name: "Delcourt Collection", document_type: "catalogue", file_url: "https://example.org/catalogue.pdf", cover_image_url: "https://example.org/cover.jpg" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockReturnValue({ data: [document], error: null });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Resources delivery recovery", () => {
  it("retries a failed catalogue query rather than treating it as an empty library", async () => {
    mocks.query.mockReturnValueOnce({ data: null, error: new Error("unavailable") });
    render(<TradeDocuments />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByRole("button", { name: /Delcourt Collection Catalogue 2026/ });
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
  it("does not record a download or open a popup for a failed HTTP response", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetch);
    const popup = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TradeDocuments />);
    fireEvent.click(await screen.findByRole("button", { name: /Delcourt Collection Catalogue 2026/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("could not download"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.track).not.toHaveBeenCalled();
    expect(popup).not.toHaveBeenCalled();
    popup.mockRestore();
  });
  it("provides stored cover images without PDF sources to maker carousels", async () => {
    render(<TradeDocuments />);
    await screen.findByRole("button", { name: /Delcourt Collection Catalogue 2026/ });
    const props = mocks.carousel.mock.calls.at(-1)?.[0];
    expect(props.brands[0].imageUrl).toBe(document.cover_image_url);
    expect(props.brands[0].pdfUrl).toBeUndefined();
  });
});