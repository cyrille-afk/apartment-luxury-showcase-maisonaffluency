/**
 * Regression: base-only products (e.g. Atelier Pendhapa "Mangala Coffee Table")
 * must render a single Finish dropdown in the admin preview panel — and
 * picking a Base must update the matched variant (price). This guards against
 * the regression where the preview hid all dropdowns for base-only products.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import VariantPreviewPanel from "@/components/admin/VariantPreviewPanel";

const MANGALA_VARIANTS = [
  { base: "Solid Teak", top: "", label: "L 130 × W 70 × H 38 cm", price_cents: 540000 },
  { base: "Burnt Oak", top: "", label: "L 130 × W 70 × H 38 cm", price_cents: 540000 },
  { base: "Blackened Ash", top: "", label: "L 130 × W 70 × H 38 cm", price_cents: 620000 },
];

describe("VariantPreviewPanel — base-only Mangala", () => {
  it("renders a single Finish dropdown (not two empty Base/Top selects)", () => {
    render(
      <VariantPreviewPanel
        sizeVariants={MANGALA_VARIANTS}
        currency="EUR"
        baseAxisLabel="Finish"
      />
    );

    // Single Finish select is present
    const finishSelect = screen.getByLabelText(/finish/i);
    expect(finishSelect).toBeInTheDocument();
    // No phantom "Top" select (which used to render with no options)
    expect(screen.queryByLabelText(/^top$/i)).not.toBeInTheDocument();
  });

  it("manual pick of any Base updates the matched price (proxy for image swap)", async () => {
    const user = userEvent.setup();
    render(
      <VariantPreviewPanel
        sizeVariants={MANGALA_VARIANTS}
        currency="EUR"
        baseAxisLabel="Finish"
      />
    );

    const finishSelect = screen.getByLabelText(/finish/i);

    // Solid Teak → €5,400
    await user.selectOptions(finishSelect, "Solid Teak");
    expect(screen.getByText(/€5,400/)).toBeInTheDocument();

    // Burnt Oak → still €5,400 (same price tier) — proves selection took effect
    await user.selectOptions(finishSelect, "Burnt Oak");
    expect(screen.getByText(/€5,400/)).toBeInTheDocument();

    // Blackened Ash → €6,200 — proves the dropdown actually drives matching
    await user.selectOptions(finishSelect, "Blackened Ash");
    expect(screen.getByText(/€6,200/)).toBeInTheDocument();
  });
});
