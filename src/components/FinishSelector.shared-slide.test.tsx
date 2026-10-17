import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FinishSelector from "./FinishSelector";

// Yoma CLW Console shape: one mapped finish per material category, every
// mapped finish on every photo (a "shared slide"), plus unmapped finishes.
const swatches = [
  { fabric_id: "bleached", name: "Bleached Oak", category: "Wood", image_indices: [1, 2, 3] },
  { fabric_id: "ebonized", name: "Ebonized Oak", category: "Wood", image_indices: null },
  { fabric_id: "bronze", name: "Patinated Bronze — Open Pore", category: "Metal", image_indices: [1, 2, 3] },
  { fabric_id: "trav-s", name: "Brown Travertine Sandblasted — Open Pore", category: "Stone", image_indices: [1, 2, 3] },
  { fabric_id: "trav-h", name: "Brown Travertine Honed — Open Pore", category: "Stone", image_indices: null },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const result = table === "designer_curator_picks_public"
        ? { data: { allow_com_col: false }, error: null }
        : { data: swatches.map((s, i) => ({ ...s, sort_order: i, image_url: null, is_active: true })), error: null };
      const query: any = {
        select: () => query,
        eq: () => query,
        order: () => query,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    },
  },
}));

describe("shared-slide finish headers", () => {
  it("pre-selects the finish that is uniquely mapped within its own dropdown", async () => {
    render(
      <FinishSelector pickId="yoma" productTitle="Yoma CLW Console" currentGalleryIndex={0}
        photoLedFinishes showUpholsterySection={false} />,
    );
    // Each closed dropdown header names the pictured finish of its category.
    await screen.findByRole("button", { name: /Select Your Wood Finish.*Bleached Oak/ });
    await screen.findByRole("button", { name: /Select Your Metal Finish.*Patinated Bronze/ });
    await screen.findByRole("button", { name: /Select Your Stone Finish.*Brown Travertine Sandblasted/ });
    // Unmapped finishes never appear in a header.
    expect(screen.queryByRole("button", { name: /Ebonized Oak/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Brown Travertine Honed/ })).not.toBeInTheDocument();
  });
});
