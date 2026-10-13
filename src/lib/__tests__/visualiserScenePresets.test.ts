import { beforeEach, describe, expect, it } from "vitest";
import { deleteScenePreset, readScenePresets, saveScenePreset } from "../visualiserScenePresets";
import { clampWallHeight, roomWallColor, roomWallFinish } from "../visualiserRoomSurfaces";
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
  it("restores the chosen floor and plaster wall with a furniture preset", () => {
    saveScenePreset("Cement room", { objects: [obj], floorFinish: "micro-cement", showRearWall: true });
    expect(readScenePresets()[0].data.floorFinish).toBe("micro-cement");
    expect(readScenePresets()[0].data.showRearWall).toBe(true);
  });
  it("preserves backdrop-only surfaces when the floor and wall are disabled", () => {
    saveScenePreset("Photo room", { objects: [obj], floorFinish: "none", showRearWall: false });
    expect(readScenePresets()[0].data.floorFinish).toBe("none");
    expect(readScenePresets()[0].data.showRearWall).toBe(false);
  });
  it("saves the wall height percentage with the preset", () => {
    saveScenePreset("Low wall", { objects: [obj], showRearWall: true, wallHeight: 60 });
    expect(readScenePresets()[0].data.wallHeight).toBe(60);
  });
  it("clamps wall height to 20–100 and defaults to full height", () => {
    expect(clampWallHeight(undefined)).toBe(100);
    expect(clampWallHeight(60)).toBe(60);
    expect(clampWallHeight(5)).toBe(20);
    expect(clampWallHeight(180)).toBe(100);
  });
  it("saves the wall colour and finish with the preset", () => {
    saveScenePreset("Sage satin", { objects: [obj], showRearWall: true, wallColor: "sage", wallFinish: "satin" });
    expect(readScenePresets()[0].data.wallColor).toBe("sage");
    expect(readScenePresets()[0].data.wallFinish).toBe("satin");
  });
  it("falls back to warm-white matte plaster for unknown wall values", () => {
    expect(roomWallColor(undefined)).toBe("warm-white");
    expect(roomWallColor("neon-pink")).toBe("warm-white");
    expect(roomWallColor("midnight")).toBe("midnight");
    expect(roomWallFinish(undefined)).toBe("matte");
    expect(roomWallFinish("mirror")).toBe("matte");
    expect(roomWallFinish("polished")).toBe("polished");
  });
});
