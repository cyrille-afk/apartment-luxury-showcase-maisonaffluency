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

import { clampRugSize, clampRugOffset } from "../visualiserRoomSurfaces";
describe("rug layout", () => {
  it("clamps size and offset", () => {
    expect(clampRugSize(null)).toBeNull();
    expect(clampRugSize(0.4)).toBe(1);
    expect(clampRugSize(12)).toBe(8);
    expect(clampRugSize(5.24)).toBe(5.2);
    expect(clampRugOffset(-9)).toBe(-4);
    expect(clampRugOffset(undefined)).toBe(0);
  });
  it("rides in presets", () => {
    saveScenePreset("Rug layout", { objects: [], rugWidth: 6, rugDepth: 4, rugOffsetX: -1.2, rugOffsetZ: 0.5 });
    const d = readScenePresets().find((p) => p.name === "Rug layout")!.data;
    expect([d.rugWidth, d.rugDepth, d.rugOffsetX, d.rugOffsetZ]).toEqual([6, 4, -1.2, 0.5]);
  });
});

import { rugVisible } from "../visualiserRoomSurfaces";
describe("rug visibility toggle", () => {
  it("shows the rug unless explicitly hidden", () => {
    expect(rugVisible(undefined)).toBe(true);
    expect(rugVisible(null)).toBe(true);
    expect(rugVisible(true)).toBe(true);
    expect(rugVisible(false)).toBe(false);
    expect(rugVisible("false")).toBe(true);
  });
  it("rides in presets", () => {
    saveScenePreset("Rug hidden", { objects: [], showRug: false });
    saveScenePreset("Rug shown", { objects: [], showRug: true });
    const hidden = readScenePresets().find((p) => p.name === "Rug hidden")!.data;
    const shown = readScenePresets().find((p) => p.name === "Rug shown")!.data;
    expect(hidden.showRug).toBe(false);
    expect(shown.showRug).toBe(true);
  });
});

describe("rug border colour", () => {
  it("defaults to matching the rug fabric", () => {
    expect(rugBorderColor(undefined)).toBe("match");
    expect(rugBorderColor(null)).toBe("match");
    expect(rugBorderColor("match")).toBe("match");
  });
  it("accepts an explicit rug colour and rejects unknown values", () => {
    expect(rugBorderColor("charcoal")).toBe("charcoal");
    expect(rugBorderColor("bogus")).toBe("cream");
  });
  it("rides in scene presets", () => {
    saveScenePreset({ name: "Border", data: { objects: [], rugBorderColor: "navy" } });
    const loaded = loadScenePresets().find((p) => p.name === "Border");
    expect(loaded?.data.rugBorderColor).toBe("navy");
  });
});
