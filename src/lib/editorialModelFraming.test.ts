import { expect, it } from "vitest";
import { editorialModelCamera, editorialUprightRotation } from "./editorialModelFraming";
it("corrects seating, storage and table Z-up exports at the requested 0.65 threshold", () => {
  for (const category of ["seating", "storage", "table"]) {
    expect(editorialUprightRotation({ x: 1, y: .64, z: 1 }, category)).toBe(-Math.PI / 2);
    expect(editorialUprightRotation({ x: 1, y: .65, z: 1 }, category)).toBe(0);
  }
  expect(editorialUprightRotation({ x: 1, y: .1, z: 1 }, "lighting")).toBe(0);
});
it("targets 45 percent of height above the grounded bottom and uses the requested hero vector", () => {
  const camera = editorialModelCamera({ x: 2, y: 1, z: 1 }, { x: 4, y: 3, z: -2 });
  expect(camera.target.toArray()).toEqual([4, 2.95, -2]);
  expect(camera.position.toArray()).toEqual([camera.radius * 1.35, camera.radius * .7, camera.radius * 1.85]);
  expect(camera.phi).toBeGreaterThan(Math.PI / 3);
  expect(camera.phi).toBeLessThan(Math.PI / 2);
});
it("keeps recorded low tables upright rather than mistaking shallow height for Z-up", () => {
  expect(editorialUprightRotation({ x: 1.08, y: .29, z: 1.08 }, "coffee table", "", { width: 1080, depth: 1080, height: 280 })).toBe(0);
  expect(editorialUprightRotation({ x: 1.28, y: .34, z: .83 }, "Praia da Granja Coffee Table")).toBe(0);
});