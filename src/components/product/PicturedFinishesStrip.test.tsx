import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PicturedFinishesStrip from "./PicturedFinishesStrip";

const rows = [
  { fabric_id: "oak", name: "Smoked Oak", category: "Wood", image_url: null, image_indices: [1], is_active: true },
  { fabric_id: "linen", name: "Ivory Linen", category: "Fabric & Leather", image_url: null, image_indices: [1, 2], is_active: true },
  { fabric_id: "walnut", name: "Walnut", category: "Wood", image_url: null, image_indices: [2], is_active: true },
];

// Rows served per pick_id so each test can exercise a different product.
const rowsByPick: Record<string, any[]> = { "not-bieke": rows };
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_col: string, pickId: string) => Promise.resolve({ data: rowsByPick[pickId] ?? [], error: null }),
      }),
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

  it("shows the strip when every photo maps to all two finishes", async () => {
    rowsByPick["two-finishes"] = [
      { fabric_id: "burl", name: "Poplar Burl with Satin Finish", category: "Wood", image_url: null, image_indices: [1, 2, 3, 4], is_active: true },
      { fabric_id: "lacq", name: "Ivory Lacquer", category: "Wood", image_url: null, image_indices: [1, 2, 3, 4], is_active: true },
    ];
    render(<PicturedFinishesStrip pickId="two-finishes" activeIndex={2} />);
    await waitFor(() => expect(screen.getByText("Poplar Burl with Satin Finish")).toBeInTheDocument());
    expect(screen.getByText("Ivory Lacquer")).toBeInTheDocument();
  });

  it("hides the strip on longer finish lists mapped to every photo", async () => {
    const all = [1, 2, 3];
    rowsByPick["three-finishes"] = ["One", "Two", "Three"].map((name, i) => ({
      fabric_id: `f${i}`, name, category: "Wood", image_url: null, image_indices: all, is_active: true,
    }));
    render(<PicturedFinishesStrip pickId="three-finishes" activeIndex={0} />);
    await waitFor(() => expect(screen.queryByText("Pictured Finishes")).not.toBeInTheDocument());
  });
});
