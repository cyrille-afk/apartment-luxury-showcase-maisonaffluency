import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { FEATURE_WALL, featureWallLayout, featureWallFinish } from "./visualiserFeatureWall";

describe("architectural feature wall", () => {
  it("creates exactly three slabs separated by two inset gaps", () => {
    const layout = featureWallLayout(new THREE.Box3());
    expect(FEATURE_WALL.panels).toBe(3);
    expect(layout.panelWidth * 3 + FEATURE_WALL.gap * 2).toBeCloseTo(layout.width);
  });
  it("stays behind furniture without changing its bounds", () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-5, 0, -6), new THREE.Vector3(3, 3, 2));
    const before = bounds.clone();
    const layout = featureWallLayout(bounds);
    expect(layout.frontZ).toBeCloseTo(-9);
    expect(layout.centerX).toBe(0);
    expect(layout.width).toBe(80);
    expect(bounds.equals(before)).toBe(true);
  });
  it("normalises stored finishes and falls back to travertine", () => {
    expect(featureWallFinish("microcement")).toBe("microcement");
    expect(featureWallFinish("raw-concrete")).toBe("raw-concrete");
    expect(featureWallFinish("travertine")).toBe("travertine");
    expect(featureWallFinish("marble")).toBe("travertine");
    expect(featureWallFinish(undefined)).toBe("travertine");
  });
});