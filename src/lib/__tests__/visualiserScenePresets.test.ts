import { beforeEach, describe, expect, it } from "vitest";
import { deleteScenePreset, readScenePresets, saveScenePreset } from "../visualiserScenePresets";
const obj = { instanceId: "a" } as never;
describe("scene presets", () => {
  beforeEach(() => localStorage.clear());
  it("saving an existing name overwrites instead of duplicating", () => {
    saveScenePreset("Lounge", { objects: [obj] });
    saveScenePreset("lounge ", { objects: [obj, obj] });
    const list = readScenePresets();
    expect(list).toHaveLength(1);
    expect(list[0].data.objects).toHaveLength(2);
  });
  it("delete removes only that preset", () => {
    saveScenePreset("A", { objects: [obj] });
    const [b] = saveScenePreset("B", { objects: [obj] });
    expect(deleteScenePreset(b.id).map((p) => p.name)).toEqual(["A"]);
  });
});
