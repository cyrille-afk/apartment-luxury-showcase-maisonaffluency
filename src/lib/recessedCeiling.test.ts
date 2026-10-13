import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CEILING, recessedCeilingGeometry, recessedCeilingShape } from "./recessedCeiling";

describe("recessed ceiling enclosure", () => {
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