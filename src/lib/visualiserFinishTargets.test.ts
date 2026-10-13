import { describe, expect, it } from "vitest";
import { classifyMeshPart, classifyTextureNode, finishTargetsFromParts, materialFitsTarget } from "./visualiserFinishTargets";

const m = (category: string, material_type: string | null = null) => ({
  id: category, name: category, brand_name: "x", category, material_type, color_family: null, image_url: null,
});

describe("visualiser finish targets", () => {
  it("only lists parts the model contains", () => {
    const parts = ["Table_Top_Mesh", "Base_Mesh"].map(classifyTextureNode).filter(Boolean) as never[];
    expect(finishTargetsFromParts(parts)).toEqual(["all", "top", "base"]);
    expect(finishTargetsFromParts([])).toEqual(["all"]);
  });

  it("Frenchmen Street chair exposes frame, base (glides) and upholstery", () => {
    const parts = ["WoodFinish", "Glides", "FabricAndLeather"].map(classifyTextureNode).filter(Boolean) as never[];
    expect(finishTargetsFromParts(parts)).toEqual(["all", "frame", "base", "upholstery"]);
  });

  it("unnamed meshes classify by material name, so Frame and Base stay separate tabs", () => {
    // Frenchmen Street GLB: mesh names are null, materials are WoodFinish / Glides / fabric.
    expect(classifyMeshPart("", "WoodFinish")).toBe("frame");
    expect(classifyMeshPart("", "Glides")).toBe("base");
    expect(classifyMeshPart("", "FabricAndLeather")).toBe("upholstery");
    const parts = ["WoodFinish", "Glides"].map((mat) => classifyMeshPart("", mat)).filter(Boolean) as never[];
    expect(finishTargetsFromParts(parts)).toEqual(["all", "frame", "base"]);
  });

  it("Top shows stone but not fabric; Base shows metal but not marble", () => {
    expect(materialFitsTarget(m("Stone", "Marble"), "top")).toBe(true);
    expect(materialFitsTarget(m("Fabric"), "top")).toBe(false);
    expect(materialFitsTarget(m("Metal", "Brass"), "base")).toBe(true);
    expect(materialFitsTarget(m("Stone", "Marble"), "base")).toBe(false);
  });

  it("explicit target overrides keywords; whole piece shows all", () => {
    expect(materialFitsTarget({ ...m("Metal"), target: "base" }, "top")).toBe(false);
    expect(materialFitsTarget(m("Fabric"), "all")).toBe(true);
  });
});

describe("three-axis pieces", () => {
  it("cabinet exposes frame, drawer and handle", () => {
    const parts = ["Carcass", "Drawer_Front", "Handle"].map(classifyTextureNode).filter(Boolean) as never[];
    expect(finishTargetsFromParts(parts)).toEqual(["all", "frame", "drawer", "handle"]);
  });
  it("unnamed material groups become their own tabs", () => {
    expect(finishTargetsFromParts(["part:b" as never, "part:a" as never])).toEqual(["all", "part:a", "part:b"]);
  });
});
