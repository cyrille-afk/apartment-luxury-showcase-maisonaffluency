import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import VariantPreviewPanel from "@/components/admin/VariantPreviewPanel";

const PORTAL_DINING_TABLE_VARIANTS = [
  { base: "Nero Kinatra Marble", top: "", label: "Ø 137 × H 74 cm", price_cents: 3300000 },
  { base: "Blackened Ash Wood", top: "", label: "Ø 137 × H 74 cm", price_cents: 2380000 },
  { base: "Bleached Ash Wood", top: "", label: "Ø 137 × H 74 cm", price_cents: 2380000 },
  { base: "Nero Portoro Marble", top: "", label: "Ø 137 × H 74 cm", price_cents: 7500000 },
  { base: "Lumachella Marble", top: "", label: "Ø 137 × H 74 cm", price_cents: 3300000 },
];

describe("VariantPreviewPanel clear selection", () => {
  it("does not keep a matched price after clearing a base-only variant selector", async () => {
    const user = userEvent.setup();
    render(
      <VariantPreviewPanel
        sizeVariants={PORTAL_DINING_TABLE_VARIANTS}
        currency="EUR"
        baseAxisLabel="Finish"
      />
    );

    const finishSelect = screen.getByLabelText(/finish/i);
    expect(screen.queryByText(/Price for selection/i)).not.toBeInTheDocument();

    await user.selectOptions(finishSelect, "Nero Portoro Marble");
    expect(screen.getByText(/€75,000/)).toBeInTheDocument();

    await user.selectOptions(finishSelect, "");
    expect(screen.queryByText(/Price for selection/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/€75,000/)).not.toBeInTheDocument();
  });
});