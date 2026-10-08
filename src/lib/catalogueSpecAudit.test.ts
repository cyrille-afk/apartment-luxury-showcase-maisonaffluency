import { describe, it, expect } from "vitest";
import { auditCatalogueSpec } from "./catalogueSpecAudit";

const base = { id: "1", title: "x" };

describe("auditCatalogueSpec", () => {
  it("flags missing dimensions", () => {
    expect(auditCatalogueSpec({ ...base, dimensions: null, materials: "Oak" })).toEqual(["missing_dimensions"]);
  });
  it("flags missing materials", () => {
    expect(auditCatalogueSpec({ ...base, dimensions: "Ø 63 × H 50 cm", materials: " " })).toEqual(["missing_materials"]);
  });
  it("flags the same size repeated for a shade option (Moiré case)", () => {
    expect(
      auditCatalogueSpec({ ...base, dimensions: "W 47 × D 25 × H 75.5 cm / W 47 × D 25 × H 75.5 cm (Special Shade)", materials: "Straw" }),
    ).toEqual(["repeated_dimensions"]);
  });
  it("does not flag genuinely different sizes", () => {
    expect(auditCatalogueSpec({ ...base, dimensions: "W 120 × H 75 cm / W 180 × H 75 cm", materials: "Oak" })).toEqual([]);
  });
});
