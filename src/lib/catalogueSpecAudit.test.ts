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
  it("recognizes Solare's satin poplar burl and lacquer variant", () => {
    expect(auditCatalogueSpec({ ...base, dimensions: "L.43.5 x D.43.5 x H.42 cm", materials: null,
      size_variants: [{ base: "Satin poplar burl & off-white lacquered edges", label: "L.43.5 x D.43.5 x H.42 cm", top: "" }],
    })).toEqual([]);
  });
  it("recognizes an active linked finish without a summary or variants", () => {
    expect(auditCatalogueSpec({ ...base, dimensions: "H 42 cm", materials: null, linkedFinishCount: 1 })).toEqual([]);
  });
  it.each(["base", "top", "materials", "material"])("recognizes variant %s as material evidence", (field) => {
    expect(auditCatalogueSpec({ ...base, dimensions: "H 42 cm", materials: null, size_variants: [{ [field]: "Oak" }] })).toEqual([]);
  });
  it("recognizes technical material descriptions", () => {
    expect(auditCatalogueSpec({ ...base, dimensions: "H 42 cm", materials: null, materials_description: "Materials: Himalayan wool" })).toEqual([]);
  });
  it("still flags size labels, empty variants and absent finishes", () => {
    expect(auditCatalogueSpec({ ...base, dimensions: "H 42 cm", materials: " ", materials_description: " ",
      linkedFinishCount: 0, size_variants: [null, { label: "Large", base: " ", top: "" }],
    })).toEqual(["missing_materials"]);
  });
  it("does not change missing-dimensions flags when finishes exist", () => {
    expect(auditCatalogueSpec({ ...base, dimensions: null, materials: null, linkedFinishCount: 1 })).toEqual(["missing_dimensions"]);
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
