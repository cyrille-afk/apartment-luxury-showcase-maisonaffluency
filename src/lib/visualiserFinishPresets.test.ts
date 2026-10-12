import { beforeEach, describe, expect, it } from "vitest";
import { deleteFinishPreset, listFinishPresets, saveFinishPreset } from "./visualiserFinishPresets";

const mat = (id: string) => ({ id, name: id, brand_name: "b", category: "Metal", material_type: null, color_family: null, image_url: null });
const base = { material: null, topMaterial: mat("marble"), baseMaterial: mat("brass"), upholsteryMaterial: null };

describe("finish presets", () => {
  beforeEach(() => localStorage.clear());

  it("saves per product and restores each part", () => {
    saveFinishPreset("table", { name: "Marble/Brass", ...base });
    expect(listFinishPresets("table")[0].baseMaterial?.id).toBe("brass");
    expect(listFinishPresets("chair")).toEqual([]);
  });

  it("same name replaces; delete removes", () => {
    saveFinishPreset("table", { name: "A", ...base });
    saveFinishPreset("table", { name: "a", ...base, baseMaterial: mat("steel") });
    expect(listFinishPresets("table")).toHaveLength(1);
    expect(listFinishPresets("table")[0].baseMaterial?.id).toBe("steel");
    deleteFinishPreset("table", "a");
    expect(listFinishPresets("table")).toEqual([]);
  });
});
