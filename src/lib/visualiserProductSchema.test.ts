import { describe, expect, it } from "vitest";
import { findProductSchema, schemaFits, schemaLabels, schemaTargets } from "./visualiserProductSchema";

const m = (name: string, category: string) => ({ id: name, name, brand_name: "", category, material_type: category, color_family: null, image_url: null }) as never;

describe("product finish schema", () => {
  it("GUM separates seat, backrest and wood frame using authored material IDs", () => {
    const schema = findProductSchema("GUM armchair");
    expect(schema?.materialRoles).toEqual({ "09 - Default": "frame", "02 - Default": "upholstery", "01 - Default": "backrest" });
    if (!schema) throw new Error("Missing GUM schema");
    expect(schemaTargets(schema)).toEqual(["all", "upholstery", "backrest", "frame"]);
    expect(schemaFits(schema, m("Edson", "Fabric"), "backrest")).toBe(true);
    expect(schemaFits(schema, m("Oak", "Wood"), "backrest")).toBe(false);
  });
  it("Madison Avenue table exposes Table Top and Base Structure", () => {
    const s = findProductSchema("Madison Avenue Side Table")!;
    expect(schemaTargets(s)).toEqual(["all", "top", "base"]);
    expect(schemaLabels(s)).toEqual({ top: "Table Top", base: "Base Structure" });
  });
  it("matches catalogue names that carry the maker suffix", () => {
    const s = findProductSchema("Madison Avenue Side Table by Yabu Pushelberg")!;
    expect(schemaLabels(s)).toEqual({ top: "Table Top", base: "Base Structure" });
    expect(findProductSchema("BOB Armchair by Christophe Delcourt")).not.toBeNull();
  });
  it("Madison top allows stones only, base metals only", () => {
    const s = findProductSchema("madison avenue side table")!;
    expect(schemaFits(s, m("Onice", "Stone"), "top")).toBe(true);
    expect(schemaFits(s, m("Arsene Quinoa", "Fabric"), "top")).toBe(false);
    expect(schemaFits(s, m("Aged Brass", "Metal"), "base")).toBe(true);
    expect(schemaFits(s, m("Onice", "Stone"), "base")).toBe(false);
  });
  it("BOB seat allows fabrics and leathers, not woods", () => {
    const s = findProductSchema("BOB Armchair")!;
    expect(schemaFits(s, m("Cognac", "Leather"), "upholstery")).toBe(true);
    expect(schemaFits(s, m("Oak", "Wood"), "upholstery")).toBe(false);
    expect(schemaFits(s, m("Oak", "Wood"), "base")).toBe(true);
  });
  it("undeclared products return null", () => {
    expect(findProductSchema("Frenchmen Street Lounge Chair")).toBeNull();
  });
});
