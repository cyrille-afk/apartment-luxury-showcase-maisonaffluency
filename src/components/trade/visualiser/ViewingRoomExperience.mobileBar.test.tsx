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

afterEach(() => { cleanup(); fetchChoices.mockReset(); });

const scrollTo = (y: number) => {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
  act(() => { fireEvent.scroll(window); });
};

describe("Stage 3 mobile sticky bottom bar", () => {
  it("stays hidden on initial load, then reveals on scroll or customization", async () => {
    scrollTo(0);
    fetchChoices.mockResolvedValue({ items: [slot], allow_alternatives: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <ViewingRoomExperience token="cipriani" packageId="pkg-1" baseTotal={350000} currency="USD" residence="Canaletto Penthouse" developer="Cipriani Residences Miami" onTotal={() => {}} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Swap piece — IBO low table" })).toBeInTheDocument());
    expect(screen.queryByLabelText("Budget Allocation")).not.toBeInTheDocument();
    const bar = container.querySelector("[data-mobile-bar-visible]") as HTMLElement;
    expect(bar.getAttribute("data-mobile-bar-visible")).toBe("false");
    scrollTo(120);
    expect(bar.getAttribute("data-mobile-bar-visible")).toBe("true");
    scrollTo(0);
    expect(bar.getAttribute("data-mobile-bar-visible")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Swap piece — IBO low table" }));
    fireEvent.click(screen.getByRole("button", { name: /Select/i }));
    expect(bar.getAttribute("data-mobile-bar-visible")).toBe("true");
  });
});
