import { describe, expect, it } from "vitest";
import { meshKey, resolvePart, setPartOverride, registerModelMeshes } from "./visualiserPartMapping";

describe("manual part mapping", () => {
  it("upgrades a legacy shared GUM backrest mapping without changing the frame", () => {
    const id = "gum-mapping-test";
    setPartOverride(id, "back", "upholstery");
    setPartOverride(id, "frame", "base");
    registerModelMeshes(id, [{ key: "back", label: "VIFS03", auto: "backrest" }, { key: "frame", label: "VIFS14", auto: "frame" }]);
    const saved = JSON.parse(localStorage.getItem("ma_visualiser_part_mapping_v1") ?? "{}")[id];
    expect(saved.back).toBeUndefined();
    expect(saved.frame).toBe("base");
  });
  it("assigns a coded part to Frame / Base", () => {
    const key = meshKey(0, "a71bd6f1");
    expect(resolvePart("a71bd6f1", key, {})).toBeNull();
    expect(resolvePart("a71bd6f1", key, { [key]: "base" })).toBe("base");
  });
  it("manual choice overrides the automatic name match", () => {
    const key = meshKey(2, "FabricAndLeather");
    expect(resolvePart("fabricandleather", key, { [key]: "none" })).toBeNull();
    expect(resolvePart("fabricandleather", key, { [key]: "top" })).toBe("top");
  });
});
