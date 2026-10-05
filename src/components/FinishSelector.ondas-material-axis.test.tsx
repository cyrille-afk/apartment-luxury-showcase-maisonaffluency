import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FinishSelector from "./FinishSelector";

const swatches = [
  { id: "clear", name: "Clear Glass", category: "Glass" },
  { id: "amber", name: "Amber Glass", category: "Glass" },
  { id: "bronze", name: "Bronze Patina – Textured", category: "Metal" },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const result = table === "designer_curator_picks_public"
        ? { data: { allow_com_col: false }, error: null }
        : { data: swatches.map((s, i) => ({
            sort_order: i, price_tier_label: null, image_indices: null,
            price_cents_a: null, fabric_id: s.id, name: s.name,
            image_url: null, category: s.category, supplier: null, is_active: true,
            fabric: { ...s, image_url: null, supplier: null, is_active: true },
          })), error: null };
      const query: any = {
        select: () => query, eq: () => query, order: () => query,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    },
  },
}));

describe("Ondas Sconce material axes", () => {
  it.each([false, true])("keeps bronze out of the glass diffuser on %s pricing mode", async (includePricing) => {
    render(<FinishSelector
      pickId="455d6a81-964c-4f76-8fc3-9f60bf5b39fd"
      includePricing={includePricing}
      productTitle="Ondas Sconce"
      showUpholsterySection={false}
      axisBaseLabel="Select Your Glass Diffuser"
      woodLabel="Select Your Glass Diffuser Tone"
      baseAxisOptions={["Clear Glass"]}
      topAxisOptions={["Hand-cast bronze"]}
      topLabel="Select Your Metal Structure"
      woodFilter={(name) => name.includes("Glass")}
      topFilter={(name) => name.includes("Hand-cast bronze")}
    />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Select Your Glass Diffuser/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Select Your Glass Diffuser/i }));
    const glassGroup = screen.getByRole("button", { name: /Select Your Glass Diffuser/i }).closest(".border-t");
    expect(glassGroup).not.toBeNull();
    expect(within(glassGroup as HTMLElement).getByRole("button", { name: "Select Clear Glass" })).toBeInTheDocument();
    expect(within(glassGroup as HTMLElement).getByRole("button", { name: "Select Amber Glass" })).toBeInTheDocument();
    expect(within(glassGroup as HTMLElement).queryByRole("button", { name: "Select Bronze Patina – Textured" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Select Your Metal Structure/i }));
    const metalGroup = screen.getByRole("button", { name: /Select Your Metal Structure/i }).closest(".border-t");
    expect(within(metalGroup as HTMLElement).getByRole("button", { name: "Select Bronze Patina – Textured" })).toBeInTheDocument();
  });
});