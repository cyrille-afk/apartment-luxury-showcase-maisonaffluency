
import { floorFocusPoint as _ffp, pickFootprintSlot as _pfs } from "@/lib/visualiserPlacement";
describe("camera-focus spawning", () => {
  it("raycasts the camera view onto the Y=0 floor", () => {
    const hit = _ffp([0, 4, 10], [0, -0.4, -1])!;
    expect(hit[0]).toBeCloseTo(0);
    expect(hit[1]).toBeCloseTo(0);
  });
  it("returns null when looking above the horizon", () => {
    expect(_ffp([0, 4, 10], [0, 0.2, -1])).toBeNull();
  });
  it("spawns at the focus point when free, not the origin", () => {
    expect(_pfs([], 0.4, 1.4, [3, -2])).toEqual([3, 0, -2]);
  });
  it("moves off an occupied focus point", () => {
    const slot = _pfs([{ position: [3, 0, -2], radius: 0.5 }], 0.4, 1.4, [3, -2]);
    expect(Math.hypot(slot[0] - 3, slot[2] + 2)).toBeGreaterThanOrEqual(1.05);
  });
});
