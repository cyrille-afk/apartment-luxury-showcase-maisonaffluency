import { describe, expect, it } from "vitest";
import { layoutCamera, layoutItems, patchLayoutItem } from "./activeProjectLayout";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
const object: PlacedObject = { id: "chair", instanceId: "chair-1", product_name: "Armchair", brand_name: "Atelier", image_url: null, dimensions: "80 × 80 × 80 cm", glb_url: "https://assets.example/chair.glb", position: [2, 0.2, -3], rotation: [0.1, Math.PI / 2, 0.2], scale: 1.2, material: { id: "oak", name: "Oak", brand_name: "Atelier", category: "Wood", material_type: "wood", color_family: "natural", image_url: "https://assets.example/oak.jpg" }, restoreKey: 4 };
describe("synchronized project coordinates", () => {
  it("maps layout X,Y to world X,Z and preserves yaw and texture", () => {
    expect(layoutItems([object])).toEqual([{ id: "chair-1", name: "Armchair", x: 2, y: -3, rotation: Math.PI / 2, texture: "https://assets.example/oak.jpg" }]);
  });
  it("preserves finish objects, height, scale, import angles and remount key while editing layout", () => {
    const patched = patchLayoutItem([object], "chair-1", { x: 1, y: 4, rotation: Math.PI })[0];
    expect(patched.position).toEqual([1, 0.2, 4]);
    expect(patched.rotation).toEqual([0.1, Math.PI, 0.2]);
    expect(patched.material).toBe(object.material);
    expect(patched.scale).toBe(1.2);
    expect(patched.restoreKey).toBe(4);
  });
  it("respects existing position locks", () => {
    const locked = { ...object, positionLocked: true };
    expect(patchLayoutItem([locked], locked.instanceId, { x: 0 })[0]).toBe(locked);
  });
  it("sets a level room-wide camera without a furniture close-up", () => {
    expect(layoutCamera({ width: 11.475, depth: 5.81, height: 3 }, "sandbox")).toEqual({ position: [0, 1.6, 13.77], target: [0, 1.6, 0], polar: Math.PI / 2, fov: 60 });
  });
  it("places the isometric camera above the same project footprint", () => {
    const camera = layoutCamera({ width: 12, depth: 8, height: 3 }, "axonometric");
    expect(camera.position).toEqual([7.800000000000001, 15, 7.2]);
    expect(camera.target).toEqual([0, 0, 0]);
  });
});