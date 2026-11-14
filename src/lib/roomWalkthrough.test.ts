import { describe, expect, it } from "vitest";
import { canStand, walkPosition, walkViewpoint } from "./roomWalkthrough";
import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";

const room = { roomDimensions: { width: 6, length: 6, height: 3 }, curatedAssets: [] } as unknown as AICuratedSceneSchema;
describe("interactive room walkthrough", () => {
  it("moves forward in the camera direction and right in screen space", () => {
    expect(walkPosition(room, [0, 1.6, 0], 0, { forward: 1, right: 0, turn: 0 }, 0.05)).toEqual([0, 1.6, -0.06999999999999999]);
    const p = walkPosition(room, [0, 1.6, 0], Math.PI / 2, { forward: 1, right: 1, turn: 0 }, 0.05);
    expect(p[0]).toBeLessThan(0); expect(p[2]).toBeLessThan(0);
    expect(Math.hypot(p[0], p[2])).toBeCloseTo(0.07);
  });
  it("stops at room walls without changing eye height", () => {
    expect(walkPosition(room, [2.75, 1.6, 0], 0, { forward: 0, right: 1, turn: 0 }, 0.05)).toEqual([2.75, 1.6, 0]);
  });
  it("keeps viewpoints and movement out of rotated furniture footprints", () => {
    const furnished = { ...room, curatedAssets: [{ position: [0, 0, 0], rotation: [0, Math.PI / 2, 0], scale: [1, 1, 1], dimensionsCubic: { w: 2, d: 1, h: 1 } }] } as AICuratedSceneSchema;
    expect(canStand(furnished, 0, 0.9)).toBe(false);
    expect(canStand(furnished, 0.9, 0)).toBe(true);
    const view = walkViewpoint(furnished, "entrance");
    expect(view).not.toBeNull();
    if (view) expect(canStand(furnished, view[0], view[2])).toBe(true);
    expect(furnished.curatedAssets[0].position).toEqual([0, 0, 0]);
  });
});