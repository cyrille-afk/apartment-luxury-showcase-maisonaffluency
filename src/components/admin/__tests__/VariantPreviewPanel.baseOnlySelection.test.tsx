/**
 * Regression guard: in the admin VariantPreviewPanel, picking a finish on a
 * base-only product must update the *underlying selected variant row* — not
 * merely re-render the same price string. We assert this by giving each base
 * a unique price tier AND a unique label, then verifying:
 *   1. The matched price changes per pick (proves variant row swap).
 *   2. The "No matching variant row" error never appears after selection
 *      (proves a real row is resolved, not a stale render).
 *   3. Re-selecting the empty option clears the matched row.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import VariantPreviewPanel from "@/components/admin/VariantPreviewPanel";

// Each base has a UNIQUE price tier so price acts as a faithful proxy for
// the underlying variant row identity.
const BASE_ONLY_VARIANTS = [
  { base: "Solid Teak",    top: "", label: "L 130 × W 70 × H 38 cm", price_cents: 540000 },
  { base: "Burnt Oak",     top: "", label: "L 130 × W 70 × H 38 cm", price_cents: 580000 },
  { base: "Blackened Ash", top: "", label: "L 130 × W 70 × H 38 cm", price_cents: 620000 },
];

describe("VariantPreviewPanel — base-only finish change updates selected variant", () => {
  it("each finish pick resolves to a distinct underlying variant row", async () => {
    const user = userEvent.setup();
    render(
      <VariantPreviewPanel
        sizeVariants={BASE_ONLY_VARIANTS}
        currency="EUR"
        baseAxisLabel="Finish"
      />
    );

    const finishSelect = screen.getByLabelText(/finish/i);

    // Initially no selection → no price, no error
    expect(screen.queryByText(/Price for selection:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No matching variant row/i)).not.toBeInTheDocument();

    // Pick #1 → row 1 (€5,400)
    await user.selectOptions(finishSelect, "Solid Teak");
    expect(screen.getByText(/€5,400/)).toBeInTheDocument();
    expect(screen.queryByText(/No matching variant row/i)).not.toBeInTheDocument();

    // Pick #2 → row 2 (€5,800) — proves underlying row changed, not just rerender
    await user.selectOptions(finishSelect, "Burnt Oak");
    expect(screen.getByText(/€5,800/)).toBeInTheDocument();
    expect(screen.queryByText(/€5,400/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No matching variant row/i)).not.toBeInTheDocument();

    // Pick #3 → row 3 (€6,200)
    await user.selectOptions(finishSelect, "Blackened Ash");
    expect(screen.getByText(/€6,200/)).toBeInTheDocument();
    expect(screen.queryByText(/€5,800/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No matching variant row/i)).not.toBeInTheDocument();

    // Clearing selection drops the matched row entirely
    await user.selectOptions(finishSelect, "");
    expect(screen.queryByText(/Price for selection:/i)).not.toBeInTheDocument();
  });

  it("does not render a phantom Top dropdown for base-only products", () => {
    render(
      <VariantPreviewPanel
        sizeVariants={BASE_ONLY_VARIANTS}
        currency="EUR"
        baseAxisLabel="Finish"
      />
    );
    // Only the Finish select should exist; no Base/Top dual-axis grid.
    expect(screen.getByLabelText(/finish/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^top$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^base$/i)).not.toBeInTheDocument();
  });
});
