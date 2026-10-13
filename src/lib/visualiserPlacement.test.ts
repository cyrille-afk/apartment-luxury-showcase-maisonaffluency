import { describe, expect, it } from "vitest";
import { pickFreeSlot } from "./visualiserPlacement";

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
