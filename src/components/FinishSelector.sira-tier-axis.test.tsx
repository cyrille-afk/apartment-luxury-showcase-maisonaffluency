import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FinishSelector from "./FinishSelector";

const swatches = [
  { id: "ferro", name: "Ferro Bronze", category: "Metal", price_tier_label: "Metal Finish" },
  { id: "light", name: "Light Bronze", category: "Metal", price_tier_label: "Metal Finish" },
  { id: "nero", name: "Nero Marquina", category: "Stone", price_tier_label: "Stone Finish" },
  { id: "bianco", name: "Bianco Statuario", category: "Stone", price_tier_label: "Stone Finish" },
  { id: "oak", name: "Natural Oak", category: "Wood", price_tier_label: "Doors Finish" },
];
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const result = table === "designer_curator_picks_public" ? { data: { allow_com_col: false }, error: null }
    : { data: swatches.map((s, i) => ({ ...s, fabric_id: s.id, sort_order: i, image_url: null, is_active: true, image_indices: [1], fabric: { ...s, image_url: null, is_active: true } })), error: null };
  const query: any = { select: () => query, eq: () => query, order: () => query, maybeSingle: () => Promise.resolve(result), then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve) };
  return query;
} } }));

describe("Sira linked finish axes", () => {
  it.each([false, true])("keeps each metal and stone option in its own selector with pricing=%s", async (includePricing) => {
    const base = vi.fn(); const top = vi.fn();
    render(<FinishSelector pickId="sira-test" productTitle="Sira Nightstand" includePricing={includePricing}
      showUpholsterySection={false} baseAxisOptions={["Metal Finish"]} topAxisOptions={["Stone Finish"]}
      axisBaseLabel="Select Your Legs Finish" woodLabel="Select Your Top" topLabel="Select Your Top"
      woodFilter={() => false} topFilter={() => false} onWoodFinishChange={base} onTopFinishChange={top} />);
    const metal = await screen.findByRole("button", { name: /Select Your Metal Finish/ });
    const stone = screen.getByRole("button", { name: /Select Your Stone Finish/ });
    fireEvent.click(metal); fireEvent.click(stone);
    await waitFor(() => expect(screen.getByRole("button", { name: "Select Ferro Bronze" })).toBeInTheDocument());
    const metalGroup = metal.closest(".border-t") as HTMLElement;
    const stoneGroup = stone.closest(".border-t") as HTMLElement;
    expect(within(metalGroup).getByRole("button", { name: "Select Light Bronze" })).toBeInTheDocument();
    expect(within(metalGroup).queryByRole("button", { name: "Select Nero Marquina" })).not.toBeInTheDocument();
    expect(within(stoneGroup).getByRole("button", { name: "Select Bianco Statuario" })).toBeInTheDocument();
    expect(within(stoneGroup).queryByRole("button", { name: "Select Ferro Bronze" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Ferro Bronze" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Nero Marquina" }));
    expect(base).toHaveBeenLastCalledWith("Metal Finish");
    expect(top).toHaveBeenLastCalledWith("Stone Finish");
    expect(screen.getByRole("button", { name: /Select Your Doors Finish/ })).toBeInTheDocument();
  });
});