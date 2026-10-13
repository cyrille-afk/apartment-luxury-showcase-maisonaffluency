import { describe, expect, it } from "vitest";
import { pickFreeSlot, respaceObjects, snapCoordinate } from "./visualiserPlacement";

describe("pickFreeSlot", () => {
  it("places the first object nearest to the centre", () => {
    const slot = pickFreeSlot([]);
    expect(slot[1]).toBe(0);
    expect(Math.abs(slot[0])).toBeLessThanOrEqual(1.4);
    expect(Math.abs(slot[2])).toBeLessThanOrEqual(1.4);
  });

  it("never places a new object on an occupied slot", () => {
    const occupied = [{ position: [0, 0, 0] as [number, number, number] }];
    const slot = pickFreeSlot(occupied);
    expect(slot).not.toEqual([0, 0, 0]);
    const stillClear = pickFreeSlot([
      { position: [0, 0, 0] },
      { position: slot },
    ]);
    expect(stillClear).not.toEqual([0, 0, 0]);
    expect(stillClear).not.toEqual(slot);
  });

  it("keeps the closest free slot to the centre when pieces are locked there", () => {
    const occupied = [
      { position: [0, 0, 0] as [number, number, number] },
      { position: [1.4, 0, 0] as [number, number, number] },
      { position: [-1.4, 0, 0] as [number, number, number] },
      { position: [0, 0, 1.4] as [number, number, number] },
      { position: [0, 0, -1.4] as [number, number, number] },
    ];
    const slot = pickFreeSlot(occupied);
    const distance = Math.hypot(slot[0], slot[2]);
    expect(distance).toBeGreaterThan(1.4);
    expect(distance).toBeLessThanOrEqual(2.1); // diagonal ring around the centre
    expect(
      occupied.some(
        (o) =>
          Math.abs(o.position[0] - slot[0]) < 0.7 &&
          Math.abs(o.position[2] - slot[2]) < 0.7,
      ),
    ).toBe(false);
  });
});

describe("spacing parameter", () => {
  it("places the next piece one spacing unit away from an occupied centre", () => {
    const slot = pickFreeSlot([{ position: [0, 0, 0] }], 2);
    const distance = Math.hypot(slot[0], slot[2]);
    expect(distance).toBeCloseTo(2);
  });

  it("clamps spacing to the supported range", () => {
    const tight = pickFreeSlot([{ position: [0, 0, 0] }], 0.1);
    expect(Math.hypot(tight[0], tight[2])).toBeCloseTo(0.6);
    const wide = pickFreeSlot([{ position: [0, 0, 0] }], 99);
    expect(Math.hypot(wide[0], wide[2])).toBeCloseTo(3);
  });
});

describe("respaceObjects", () => {
  it("never moves a position-locked piece when respacing the scene", () => {
    const fixed = { id: "locked", positionLocked: true, position: [0, 0, 0] as [number, number, number] };
    const moved = respaceObjects([fixed, { id: "free", positionLocked: false, position: [0.1, 0, 0] as [number, number, number] }], 2);
    expect(moved.find(object => object.id === "locked")).toBe(fixed);
    expect(moved.find(object => object.id === "free")?.position).not.toEqual(fixed.position);
  });
  it("keeps every piece on the grid at the new spacing with no overlaps", () => {
    const objects = [
      { id: "a", position: [0, 0, 0] as [number, number, number] },
      { id: "b", position: [0.2, 0, 0.1] as [number, number, number] },
      { id: "c", position: [5, 0, 5] as [number, number, number] },
    ];
    const respaced = respaceObjects(objects, 2);
    expect(respaced).toHaveLength(3);
    for (const object of respaced) {
      expect(object.position[0] % 2).toBeCloseTo(0);
      expect(object.position[2] % 2).toBeCloseTo(0);
    }
    const keys = new Set(respaced.map((o) => `${o.position[0]},${o.position[2]}`));
    expect(keys.size).toBe(3);
  });

  it("preserves object identity and non-position fields", () => {
    const objects = [
      { id: "a", scale: 2, position: [3, 0, 0] as [number, number, number] },
      { id: "b", scale: 1, position: [0, 0, 0] as [number, number, number] },
    ];
    const respaced = respaceObjects(objects, 1);
    expect(respaced.find((o) => o.id === "a")?.scale).toBe(2);
    // The centre piece stays at the centre.
    expect(respaced.find((o) => o.id === "b")?.position).toEqual([0, 0, 0]);
  });
});

describe("snapCoordinate", () => {
  it("rounds to the nearest 0.25 m grid line", () => {
    expect(snapCoordinate(1.13)).toBeCloseTo(1.25);
    expect(snapCoordinate(1.12)).toBeCloseTo(1);
    expect(snapCoordinate(-0.4)).toBeCloseTo(-0.5);
    expect(snapCoordinate(0)).toBe(0);
  });

  it("respects a custom step", () => {
    expect(snapCoordinate(1.3, 0.5)).toBeCloseTo(1.5);
  });
});

import { footprintRadius, pickFootprintSlot } from "./visualiserPlacement";
describe("pickFootprintSlot", () => {
  it("never places a new armchair inside a scaled-up existing armchair", () => {
    const big = { position: [0, 0, 0] as [number, number, number], radius: footprintRadius({ w: 820, d: 770 }, 2.18) };
    const r = footprintRadius({ w: 900, d: 920 });
    const slot = pickFootprintSlot([big], r, 2.8);
    expect(Math.hypot(slot[0], slot[2])).toBeGreaterThanOrEqual(big.radius + r);
  });
});

import { resolveDragPosition } from "./visualiserPlacement";
describe("resolveDragPosition", () => {
  const chair = { position: [0, 0, 0] as [number, number, number], radius: 0.8 };

  it("leaves a clear position untouched", () => {
    expect(resolveDragPosition(5, 5, 0.5, [chair])).toEqual([5, 5]);
  });

  it("pushes a dropped piece out of another piece's footprint", () => {
    const [x, z] = resolveDragPosition(0.3, 0, 0.5, [chair]);
    expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(0.8 + 0.5);
  });

  it("handles a drop dead-centre on another piece", () => {
    const [x, z] = resolveDragPosition(0, 0, 0.5, [chair]);
    expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(0.8 + 0.5);
  });

  it("resolves against a cluster of pieces", () => {
    const obstacles = [
      chair,
      { position: [1.6, 0, 0] as [number, number, number], radius: 0.8 },
      { position: [0.8, 0, 1.4] as [number, number, number], radius: 0.8 },
    ];
    const [x, z] = resolveDragPosition(0.8, 0, 0.5, obstacles);
    for (const o of obstacles) {
      expect(Math.hypot(x - o.position[0], z - o.position[2])).toBeGreaterThanOrEqual(o.radius + 0.5);
    }
  });
});
