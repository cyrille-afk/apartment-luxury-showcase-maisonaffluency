import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FinishSelector from "./FinishSelector";

const swatches = [
  { fabric_id: "green", name: "Green Blue", image_indices: [4] },
  { fabric_id: "turquoise", name: "Turquoise", image_indices: [3, 4] },
  { fabric_id: "olive", name: "Olive Green", image_indices: [1] },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const result = table === "designer_curator_picks_public"
        ? { data: { allow_com_col: false }, error: null }
        : { data: swatches.map((s, i) => ({ ...s, sort_order: i, category: "Other", image_url: null, is_active: true })), error: null };
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

describe("pictured finishes sharing one picker", () => {
  it("shows both finishes on a photo without committing either to pricing", async () => {
    const onWoodFinishChange = vi.fn();
    const onWoodFinishPricingChange = vi.fn();
    render(
      <FinishSelector pickId="oko" productTitle="OKO side table" currentGalleryIndex={3}
        photoLedFinishes showUpholsterySection={false}
        onWoodFinishChange={onWoodFinishChange} onWoodFinishPricingChange={onWoodFinishPricingChange} />,
    );
    const header = await screen.findByRole("button", { name: /Green Blue.*Turquoise/ });
    fireEvent.click(header);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select Green Blue" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Select Turquoise" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Select Olive Green" })).toHaveAttribute("aria-pressed", "false");
    });
    expect(onWoodFinishChange).not.toHaveBeenCalledWith("Turquoise");
    expect(onWoodFinishPricingChange).not.toHaveBeenCalledWith(expect.objectContaining({ name: "Turquoise" }));
  });
});