import { describe, expect, it } from "vitest";
import { clampToRoom, columnObstacles, layoutCamera, patchLayoutItem } from "./activeProjectLayout";
const bounds = { width: 12, depth: 8, height: 3 };
const chair = { instanceId: "a", product_name: "Chair", position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 } as never;
describe("plan ↔ 3D shared coordinates", () => {
  it("writes plan x/y straight into 3D x/z", () => {
    const [moved] = patchLayoutItem([chair], "a", { x: 2.5, y: -1.25 }, bounds);
    expect(moved.position).toEqual([2.5, 0, -1.25]);
  });
  it("keeps pieces inside the room walls", () => {
    expect(clampToRoom(9, -9, bounds)).toEqual([6, -4]);
    expect(clampToRoom(9, 0, bounds, 0.5)).toEqual([5.5, 0]);
  });
  it("turns plan columns into 3D obstacles at the same point", () => {
    expect(columnObstacles([{ id: "c", x: 1, y: 2, size: 0.4 }])[0].position).toEqual([1, 0, 2]);
  });
  it("aims both 3D cameras at the plan origin", () => {
    expect(layoutCamera(bounds, "axonometric").target).toEqual([0, 0, 0]);
    expect(layoutCamera(bounds, "sandbox").target.slice(0, 1).concat(layoutCamera(bounds, "sandbox").target[2])).toEqual([0, 0]);
  });
});
