import { describe, expect, it, vi } from "vitest";
import type { ScenePresetData } from "./visualiserScenePresets";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
import { snapshotData, validateSnapshot, saveProjectSnapshot, loadProjectSnapshot } from "./projectLayoutSnapshots";
import { supabase } from "@/integrations/supabase/client";
const scene = { objects: [{ instanceId: "chair-one", position: [1, 0, 2], rotation: [0, 0.5, 0], material: { name: "AVA Ecru", image_url: "https://example.com/ava.jpg" }, partMaterials: { frame: { name: "Oak" } }, positionLocked: true }], floorFinish: "micro-cement" } as unknown as ScenePresetData;
const bounds = { width: 11.475, depth: 5.81, height: 3 };
describe("named project snapshots", () => {
  it("freezes furniture positions and selected finishes independently of later edits", () => {
    const source = structuredClone(scene);
    const saved = snapshotData(source, bounds, "https://example.com/plan.jpg");
    source.objects[0].position[0] = 7;
    expect(saved.scene.objects[0].position).toEqual([1, 0, 2]);
    expect(saved.scene.objects[0].material?.name).toBe("AVA Ecru");
    expect(saved.scene.objects[0].partMaterials).toEqual({ frame: { name: "Oak" } });
    expect(saved.scene.objects[0].positionLocked).toBe(true);
  });
  it("restores full room bounds and floor plan as well as scene", () => {
    const saved = snapshotData(scene, bounds, "https://example.com/plan.jpg");
    expect(validateSnapshot(saved)).toEqual(saved);
    expect(saved.bounds).toEqual({ width: 11.475, depth: 5.81, height: 3 });
    expect(saved.floorPlanUrl).toBe("https://example.com/plan.jpg");
  });
  it("rejects invalid transforms before restoring", () => {
    const saved = snapshotData(scene, bounds, null);
    saved.scene.objects[0].position = [NaN, 0, 0];
    expect(() => validateSnapshot(saved)).toThrow("cannot be restored");
  });
  it("rejects unsupported versions and invalid room bounds", () => {
    expect(() => validateSnapshot({ ...snapshotData(scene, bounds, null), version: 2 })).toThrow();
    expect(() => validateSnapshot(snapshotData(scene, { ...bounds, width: -1 }, null))).toThrow();
  });
  it("allows intentional empty layouts", () => {
    expect(validateSnapshot(snapshotData({ objects: [] }, bounds, null)).scene.objects).toEqual([]);
  });
  it("inserts a new snapshot for every save even with the same name", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "new-id", name: "Option A" }, error: null });
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);
    await saveProjectSnapshot("project-one", "Option A", snapshotData(scene, bounds, null));
    await saveProjectSnapshot("project-one", "Option A", snapshotData(scene, bounds, null));
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0]).toMatchObject({ project_key: "project-one", name: "Option A", piece_count: 1 });
    expect(insert.mock.calls[0][0]).not.toHaveProperty("id");
  });
  it("scopes restore to both snapshot and active project", async () => {
    const eq = vi.fn();
    eq.mockReturnValue({ eq, single: async () => ({ data: { data: snapshotData(scene, bounds, null) }, error: null }) });
    vi.mocked(supabase.from).mockReturnValue({ select: () => ({ eq }) } as never);
    await loadProjectSnapshot("project-one", "snapshot-one");
    expect(eq.mock.calls).toEqual([["project_key", "project-one"], ["id", "snapshot-one"]]);
  });
  it("reports server save failure without a successful snapshot", async () => {
    vi.mocked(supabase.from).mockReturnValue({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error("offline") }) }) }) } as never);
    await expect(saveProjectSnapshot("project-one", "Option A", snapshotData(scene, bounds, null))).rejects.toThrow("offline");
  });
});
