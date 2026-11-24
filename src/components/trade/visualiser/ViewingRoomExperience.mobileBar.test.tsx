import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ViewingRoomExperience from "./ViewingRoomExperience";
import type { ViewingRoomSlot } from "@/lib/viewingRoom";

const fetchChoices = vi.fn();
vi.mock("@/lib/viewingRoom.functions", () => ({
  getViewingRoomChoices: (...args: unknown[]) => fetchChoices(...args),
  lockViewingRoomProposal: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("../Product3DViewer", () => ({ default: () => <div data-testid="viewer-3d" /> }));
vi.mock("@/lib/viewingRoomProposal", () => ({ downloadViewingRoomProposal: vi.fn() }));

const slot: ViewingRoomSlot = {
  id: "11111111-1111-4111-8111-111111111111", product_name: "IBO low table", brand_name: "Delcourt Collection",
  category: "Tables", subcategory: "Coffee Tables", image_url: null, dimensions: "Low table 120 Ø 120 x H 41 cm",
  width_mm: null, depth_mm: null, height_mm: null, glb_url: null, lead_time: "16 weeks", materials: {},
  retail_price: 10000, retail_price_from: false, is_swappable: true, allow_finish_customization: true,
  size_options: [], finish_options: [],
  alternatives: [{ id: "22222222-2222-4222-8222-222222222222", product_name: "Rift CTS", brand_name: "Kerstens", category: "Tables", subcategory: null, image_url: null, dimensions: null, width_mm: null, depth_mm: null, height_mm: null, glb_url: null, lead_time: "16 weeks", materials: {}, retail_price: 11000, retail_price_from: false, size_options: [], finish_options: [] }],
};

const originalIO = globalThis.IntersectionObserver;
afterEach(() => { cleanup(); fetchChoices.mockReset(); globalThis.IntersectionObserver = originalIO; });

describe("Stage 3 mobile sticky bottom bar", () => {
  it("stays hidden while the top budget bar is visible, then reveals on scroll or customization", async () => {
    let notify: ((entries: Partial<IntersectionObserverEntry>[]) => void) | null = null;
    globalThis.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) { notify = (entries) => cb(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver); }
      observe() {} disconnect() {} unobserve() {} takeRecords() { return []; }
      readonly root = null; readonly rootMargin = ""; readonly thresholds = [0];
    } as unknown as typeof IntersectionObserver;
    fetchChoices.mockResolvedValue({ items: [slot], allow_alternatives: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <ViewingRoomExperience token="cipriani" packageId="pkg-1" baseTotal={350000} currency="USD" residence="Canaletto Penthouse" developer="Cipriani Residences Miami" onTotal={() => {}} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText("Budget Allocation")).toBeInTheDocument());
    const bar = container.querySelector("[data-mobile-bar-visible]") as HTMLElement;
    expect(bar.getAttribute("data-mobile-bar-visible")).toBe("false");
    act(() => notify?.([{ isIntersecting: false }]));
    expect(bar.getAttribute("data-mobile-bar-visible")).toBe("true");
    act(() => notify?.([{ isIntersecting: true }]));
    expect(bar.getAttribute("data-mobile-bar-visible")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Swap piece — IBO low table" }));
    fireEvent.click(screen.getByRole("button", { name: /Select/i }));
    expect(bar.getAttribute("data-mobile-bar-visible")).toBe("true");
  });
});