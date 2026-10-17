import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ARCHITECTURE, architecturalRoomLayout } from "./visualiserArchitecture";

describe("architectural room placement", () => {
  it("keeps the horizontal slab overhead without obstructing furniture", () => {
    for (const top of [2, 6]) {
      const layout = architecturalRoomLayout(new THREE.Box3(new THREE.Vector3(-2, 0, -3), new THREE.Vector3(2, top, 2)), -8);
      expect(layout.balconyY + ARCHITECTURE.slabThickness / 2).toBe(layout.height);
      expect(layout.balconyY - ARCHITECTURE.slabThickness / 2).toBeGreaterThan(top + 3);
    }
  });
  it("keeps both foreground columns absent on load and regeneration without moving furniture", () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-2, 0, -3), new THREE.Vector3(5, 2, 2));
    const before = bounds.clone();
    const layout = architecturalRoomLayout(bounds, -8);
    expect(layout.columns).toHaveLength(0);
    expect(architecturalRoomLayout(new THREE.Box3(), -8).columns).toHaveLength(0);
    expect(architecturalRoomLayout(bounds, -8).columns).toHaveLength(0);
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