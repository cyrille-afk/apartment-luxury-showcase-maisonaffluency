import { describe, it, expect } from "vitest";
import { clampRugPile, rugColor, rugColorHex, rugWeave } from "../visualiserRoomSurfaces";
import { saveScenePreset, readScenePresets } from "../visualiserScenePresets";

describe("rug settings", () => {
  it("defaults and clamps", () => {
    expect(rugColor("bogus")).toBe("cream");
    expect(rugColorHex("charcoal")).toBe("#55524e");
    expect(rugWeave(undefined)).toBe("loop");
    expect(rugWeave("herringbone")).toBe("herringbone");
    expect(clampRugPile(undefined)).toBe(50);
    expect(clampRugPile(140)).toBe(100);
    expect(clampRugPile(-3)).toBe(0);
  });
  it("rides in presets", () => {
    saveScenePreset("Rug test", { objects: [], rugColor: "sage", rugWeave: "ribbed", rugPile: 80 });
    const d = readScenePresets().find((p) => p.name === "Rug test")!.data;
    expect([d.rugColor, d.rugWeave, d.rugPile]).toEqual(["sage", "ribbed", 80]);
  });
});
