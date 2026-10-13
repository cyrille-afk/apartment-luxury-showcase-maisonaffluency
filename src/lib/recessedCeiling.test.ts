import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CEILING, recessedCeilingGeometry, recessedCeilingShape } from "./recessedCeiling";
import { clampCeilingHeight, clampCeilingOpening, clampCeilingThickness } from "./visualiserCeilingSettings";

describe("recessed ceiling enclosure", () => {
  it("accepts manual frame height and retains automatic height for older scenes", () => {
    expect(clampCeilingHeight(3.5)).toBe(3.5);
    expect(clampCeilingHeight(undefined)).toBeNull();
    expect(clampCeilingHeight(100)).toBe(6);
  });
  it("changes physical lip thickness", () => {
    const geometry = recessedCeilingGeometry(13, 0.3, 70);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.max.z).toBeCloseTo(0.3, 5);
    expect(clampCeilingThickness(undefined)).toBe(0.15);
    geometry.dispose();
  });
  it("changes the cutout span with opening size", () => {
    const points = recessedCeilingShape(13, 70).holes[0].getPoints();
    expect(Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))).toBeCloseTo(18.2, 5);
    expect(clampCeilingOpening(100)).toBe(95);
  });
  it("keeps a real central cutout instead of filling the ceiling frame", () => {
    const shape = recessedCeilingShape(13);
    expect(shape.holes).toHaveLength(1);
    const points = shape.extractPoints(1);
    const triangles = THREE.ShapeUtils.triangulateShape(points.shape, points.holes);
    const vertices = [...points.shape, ...points.holes.flat()];
    let area = 0;
    for (const [a, b, c] of triangles) {
      const va = vertices[a], vb = vertices[b], vc = vertices[c];
      area += Math.abs((vb.x - va.x) * (vc.y - va.y) - (vc.x - va.x) * (vb.y - va.y)) / 2;
    }
    expect(area).toBeCloseTo(26 ** 2 - 23.2 ** 2, 5);
  });
  it("extrudes a 15 cm solid lip downwards", () => {
    const geometry = recessedCeilingGeometry(13);
    geometry.rotateX(Math.PI / 2);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.y).toBeCloseTo(-0.15, 5);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(0, 5);
    expect(CEILING.recess).toBe(0.25);
    geometry.dispose();
  });
});