import { describe, expect, it } from "vitest";
import { editorialUnnamedMaterialRole } from "./editorialModelMaterials";
describe("audited Rift CTS material indices", () => {
  it("routes oak and travertine independently on the 128 cm export", () => {
    const url = "https://example.org/w-128-d-128-h-28-cm---bleached-oak-or-smoked-1793877869830.glb";
    expect([0, 1, 2, 3, 4, 5, 6].map(i => editorialUnnamedMaterialRole(url, i, 7))).toEqual(["base", "base", "base", "base", "ignore", "top", "top"]);
  });
  it("uses the six-material 148 cm export without shifting stone to wood", () => {
    const url = "https://example.org/w-148-d-148-h-28-cm---bleached-oak-or-smoked-1793877899696.glb";
    expect(editorialUnnamedMaterialRole(url, 4, 6)).toBe("top");
    expect(editorialUnnamedMaterialRole(url, 3, 6)).toBe("base");
    expect(editorialUnnamedMaterialRole(url, 4, 7)).toBeNull();
  });
  it("does not guess for unrelated or re-exported models", () => {
    expect(editorialUnnamedMaterialRole("https://example.org/new-rift.glb", 0, 7)).toBeNull();
  });
});