import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import FinishSelector, { OOL_MINIBAR_PICK_ID } from "./FinishSelector";

/**
 * Regression guard: the OOL 77 Mini bar must show exactly TWO finish
 * dropdowns on both the public and Trade product pages:
 *   - Frame Finish: Cement Stuc + Glossy Lacquer
 *   - Drawer Finish: Wood species + Suede Leather
 * The Shelf axis has a single value ("Wood") and must never render as a
 * third dropdown — it is auto-committed internally instead.
 *
 * Both pages share this component keyed by OOL_MINIBAR_PICK_ID, so the
 * grouping contract is tested here; the page-wiring test below guards the
 * props each page passes.
 */

const SWATCHES = [
  { id: "sw-stuc-grey", name: "Cement Stuc - Light Grey", category: "Other" },
  { id: "sw-stuc-black", name: "Cement Stuc - Black", category: "Other" },
  { id: "sw-lacq-beige", name: "Glossy Lacquer - Silky Beige", category: "Other" },
  { id: "sw-afro", name: "Afrormosia", category: "Wood" },
  { id: "sw-maple", name: "Maple", category: "Wood" },
  { id: "sw-suede-hazel", name: "Suede Leather - Dark Hazel", category: "Fabric & Leather" },
  { id: "sw-suede-forest", name: "Suede Leather - Forest Green", category: "Fabric & Leather" },
];

const makeThenableQuery = (result: unknown) => {
  const q: any = {
    select: () => q,
    eq: () => q,
    order: () => q,
    maybeSingle: () => Promise.resolve(result),
    then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "designer_curator_picks_public") {
        return makeThenableQuery({ data: { allow_com_col: false }, error: null });
      }
      if (table === "product_fabric_swatches_public") {
        return makeThenableQuery({
          data: SWATCHES.map((s, i) => ({
            sort_order: i,
            price_tier_label: null,
            image_indices: null,
            fabric_id: s.id,
            name: s.name,
            image_url: null,
            category: s.category,
            supplier: null,
            is_active: true,
          })),
          error: null,
        });
      }
      if (table === "product_fabrics") {
        return makeThenableQuery({
          data: SWATCHES.map((s, i) => ({
            sort_order: i,
            price_tier_label: null,
            image_indices: null,
            price_cents_a: null,
            fabric: { ...s, image_url: null, supplier: null, is_active: true, price_per_lm_cents: null, tier: null, currency: "EUR" },
          })),
          error: null,
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

const renderMinibar = (includePricing: boolean) =>
  render(
    <FinishSelector
      pickId={OOL_MINIBAR_PICK_ID}
      productTitle="OOL 77 Mini bar"
      productCategory="Buffets, Cabinets and Sideboards"
      includePricing={includePricing}
      frameOptions={["Cement Stuc", "Glossy Lacquer"]}
      topLabel="Select Your Drawer Finish"
      topFilter={(name) => /^suede leather/i.test(name)}
      woodLabel="Select Your Shelf Finish"
    />,
  );

describe("OOL 77 Mini bar finish dropdowns", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["public", false],
    ["trade", true],
  ] as const)("shows only Frame + Drawer dropdowns on the %s page", async (_label, includePricing) => {
    renderMinibar(includePricing);

    await waitFor(() => {
      expect(screen.getByText("Select Your Frame Finish")).toBeInTheDocument();
    });
    expect(screen.getByText("Select Your Drawer Finish")).toBeInTheDocument();

    // The Shelf axis must never surface as a dropdown.
    expect(screen.queryByText("Select Your Shelf Finish")).not.toBeInTheDocument();
    expect(screen.queryByText(/shelf finish/i)).not.toBeInTheDocument();
  });

  it.each([
    ["public", false],
    ["trade", true],
  ] as const)("offers the requested options on the %s page", async (_label, includePricing) => {
    renderMinibar(includePricing);

    const frameHeader = await screen.findByText("Select Your Frame Finish");
    fireEvent.click(frameHeader);
    await waitFor(() => {
      expect(screen.getByLabelText("Select Cement Stuc - Light Grey")).toBeInTheDocument();
      expect(screen.getByLabelText("Select Glossy Lacquer - Silky Beige")).toBeInTheDocument();
    });

    const drawerHeader = screen.getByText("Select Your Drawer Finish");
    fireEvent.click(drawerHeader);
    await waitFor(() => {
      expect(screen.getByLabelText("Select Afrormosia")).toBeInTheDocument();
      expect(screen.getByLabelText("Select Maple")).toBeInTheDocument();
      expect(screen.getByLabelText("Select Suede Leather - Dark Hazel")).toBeInTheDocument();
    });
  });

  it("auto-commits the single-value Shelf axis as Wood without showing it", async () => {
    const onWoodFinishChange = vi.fn();
    render(
      <FinishSelector
        pickId={OOL_MINIBAR_PICK_ID}
        productTitle="OOL 77 Mini bar"
        frameOptions={["Cement Stuc", "Glossy Lacquer"]}
        topLabel="Select Your Drawer Finish"
        onWoodFinishChange={onWoodFinishChange}
      />,
    );
    await waitFor(() => {
      expect(onWoodFinishChange).toHaveBeenCalledWith("Wood");
    });
  });
});
