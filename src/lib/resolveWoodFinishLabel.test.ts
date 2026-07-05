import { describe, it, expect } from "vitest";
import { resolveWoodFinishLabel } from "./resolveWoodFinishLabel";

describe("resolveWoodFinishLabel (quote → PDF finish resolution)", () => {
  it("returns null when no wood_fabric is attached", () => {
    expect(resolveWoodFinishLabel(null, "Bronze", [])).toBeNull();
    expect(resolveWoodFinishLabel({ name: "" }, "Bronze", [])).toBeNull();
  });

  it("REGRESSION: suppresses metal swatch reused as wood_fabric when already listed under Selected finishes", () => {
    // Socle Table Lamp — metal finish stored in wood_fabric_id, must not
    // reappear as a separate "Wood finish:" row when the same swatch is
    // already resolved into variant_swatches.
    const result = resolveWoodFinishLabel(
      { name: "Light Bronze Medal 0922" },
      "Bronze · Chintz",
      [{ name: "Light Bronze Medal 0922" }],
    );
    expect(result).toBeNull();
  });

  it("REGRESSION: suppresses when variant label already contains the wood name verbatim", () => {
    const result = resolveWoodFinishLabel(
      { name: "Walnut" },
      "Walnut · Linen CAT A",
      [],
    );
    expect(result).toBeNull();
  });

  it("suppresses on partial overlap (swatch name is a substring of the wood label, e.g. 'Bronze' vs 'Light Bronze Medal 0922')", () => {
    const result = resolveWoodFinishLabel(
      { name: "Light Bronze Medal 0922" },
      "Bronze",
      [{ name: "Bronze" }],
    );
    expect(result).toBeNull();
  });

  it("keeps the Wood finish row for genuine wood items where the finish is NOT reflected elsewhere", () => {
    const result = resolveWoodFinishLabel(
      { name: "Smoked Oak" },
      "Standard",
      [],
    );
    expect(result).toBe("Wood finish: Smoked Oak");
  });

  it("keeps the Wood finish row when swatches are for an unrelated finish", () => {
    const result = resolveWoodFinishLabel(
      { name: "Smoked Oak" },
      "Bronze · Chintz",
      [{ name: "Light Bronze Medal 0922" }, { name: "Chintz" }],
    );
    expect(result).toBe("Wood finish: Smoked Oak");
  });

  it("is case-insensitive", () => {
    const result = resolveWoodFinishLabel(
      { name: "LIGHT BRONZE MEDAL 0922" },
      "bronze",
      [{ name: "light bronze medal 0922" }],
    );
    expect(result).toBeNull();
  });

  it("ignores empty swatch names safely", () => {
    const result = resolveWoodFinishLabel(
      { name: "Smoked Oak" },
      null,
      [{ name: "" }, { name: null as unknown as string }],
    );
    expect(result).toBe("Wood finish: Smoked Oak");
  });
});
