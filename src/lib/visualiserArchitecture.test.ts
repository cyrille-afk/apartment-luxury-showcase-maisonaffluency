import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ARCHITECTURE, architecturalRoomLayout } from "./visualiserArchitecture";

describe("architectural room placement", () => {
  it("places both right-side columns outside furniture without moving its bounds", () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-2, 0, -3), new THREE.Vector3(5, 2, 2));
    const before = bounds.clone();
    const layout = architecturalRoomLayout(bounds, -8);
    expect(layout.columns).toHaveLength(2);
    for (const [x] of layout.columns) expect(x - ARCHITECTURE.columnSize / 2).toBeGreaterThan(bounds.max.x);
    expect(bounds.equals(before)).toBe(true);
  });
  it("keeps the mezzanine behind the furniture and provides two-storey height", () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-2, 0, -3), new THREE.Vector3(2, 2, 2));
    const layout = architecturalRoomLayout(bounds, -8);
    expect(layout.balconyFrontZ).toBeLessThan(bounds.min.z);
    expect(layout.height).toBe(7.6);
    expect(ARCHITECTURE.railingHeight).toBe(1.1);
  });
});