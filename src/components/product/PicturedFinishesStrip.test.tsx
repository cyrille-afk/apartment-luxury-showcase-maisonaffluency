import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PicturedFinishesStrip from "./PicturedFinishesStrip";

const rows = [
  { fabric_id: "oak", name: "Smoked Oak", category: "Wood", image_url: null, image_indices: [1], is_active: true },
  { fabric_id: "linen", name: "Ivory Linen", category: "Fabric & Leather", image_url: null, image_indices: [1, 2], is_active: true },
  { fabric_id: "walnut", name: "Walnut", category: "Wood", image_url: null, image_indices: [2], is_active: true },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: rows, error: null }) }),
    }),
  },
}));

describe("pictured finishes for any product", () => {
  it("shows only the finishes mapped to the current image, not unrelated finishes", async () => {
    const { rerender } = render(<PicturedFinishesStrip pickId="not-bieke" activeIndex={0} />);
    await waitFor(() => expect(screen.getByText("Smoked Oak")).toBeInTheDocument());
    expect(screen.getByText("Ivory Linen")).toBeInTheDocument();
    expect(screen.queryByText("Walnut")).not.toBeInTheDocument();
    rerender(<PicturedFinishesStrip pickId="not-bieke" activeIndex={1} />);
    expect(screen.getByText("Walnut")).toBeInTheDocument();
    expect(screen.queryByText("Smoked Oak")).not.toBeInTheDocument();
    rerender(<PicturedFinishesStrip pickId="not-bieke" activeIndex={2} />);
    expect(screen.queryByText("Pictured Finishes")).not.toBeInTheDocument();
  });
});