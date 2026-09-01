import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import CratesEditor from "../CratesEditor";
import { CrateSpec, HsCodeRule, cratesForSize, resolveHsCode } from "@/lib/crateSpecs";

function Harness() {
  const [crates, setCrates] = useState<CrateSpec[]>([]);
  const [rules, setRules] = useState<HsCodeRule[]>([]);
  return (
    <CratesEditor
      crateSpecsRaw={crates}
      hsCodeRulesRaw={rules}
      sizeVariantsRaw={[{ label: "Small" }, { label: "Large" }, { label: "Small" }]}
      currency="EUR"
      onChangeCrates={setCrates}
      onChangeHsRules={setRules}
    />
  );
}

describe("CratesEditor", () => {
  it("adds multiple crates with size links and prices", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /add crate/i }));
    fireEvent.click(screen.getByRole("button", { name: /add crate/i }));
    const labels = screen.getAllByPlaceholderText(/crate label/i);
    expect(labels).toHaveLength(2);

    // Size options come from size_variants, de-duplicated.
    const selects = screen.getAllByRole("combobox");
    expect(selects[0].querySelectorAll("option")).toHaveLength(3); // All sizes + Small + Large
    fireEvent.change(selects[0], { target: { value: "Large" } });
    expect((selects[0] as HTMLSelectElement).value).toBe("Large");

    // Crate price is captured in major units and stored in cents.
    const priceInput = screen.getAllByPlaceholderText("e.g. 180")[0];
    fireEvent.change(priceInput, { target: { value: "180" } });
    expect((priceInput as HTMLInputElement).value).toBe("180");
  });

  it("adds HS code rules by material", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /add rule/i }));
    fireEvent.change(screen.getByPlaceholderText(/material \/ finish keyword/i), {
      target: { value: "Marble" },
    });
    expect(screen.getByDisplayValue("Marble")).toBeTruthy();
  });
});

describe("crate resolution helpers", () => {
  const base = {
    id: "x",
    label: "",
    qty: 1,
    length_cm: null,
    width_cm: null,
    height_cm: null,
    cbm: null,
    weight_kg: null,
    crate_price_cents: null,
    currency: "EUR",
    hs_code: "",
  };
  const crates: CrateSpec[] = [
    { ...base, id: "a", size_label: "" },
    { ...base, id: "b", size_label: "Large" },
    { ...base, id: "c", size_label: "Large" },
  ];

  it("prefers size-specific crates, falls back to generic", () => {
    expect(cratesForSize(crates, "Large").map((c) => c.id)).toEqual(["b", "c"]);
    expect(cratesForSize(crates, "Small").map((c) => c.id)).toEqual(["a"]);
    expect(cratesForSize(crates, null).map((c) => c.id)).toEqual(["a"]);
  });

  it("resolves HS code from the finish, longest keyword wins", () => {
    const rules: HsCodeRule[] = [
      { id: "1", material: "Oak", hs_code: "9403.60" },
      { id: "2", material: "Oiled Oak", hs_code: "9403.61" },
      { id: "3", material: "Marble", hs_code: "9403.90" },
    ];
    expect(resolveHsCode(rules, "Oiled Oak / Linen")).toBe("9403.61");
    expect(resolveHsCode(rules, "Marble top")).toBe("9403.90");
    expect(resolveHsCode(rules, "Brass", "9405.10")).toBe("9405.10");
  });
});
