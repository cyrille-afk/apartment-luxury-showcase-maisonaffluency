import { expect, it } from "vitest";
import { resetModelOrientation } from "./resetModelOrientation";

it("resets import rotation without changing placement, size or finishes", () => {
  const piece = { modelOrientation: [0.707, 0, 0, 0.707], position: [2, 0, 3], rotation: [0, 0.6, 0], scale: 1.2, material: { id: "oak" } };
  const reset = resetModelOrientation(piece);
  expect(reset.modelOrientation).toBeUndefined();
  expect(reset.position).toEqual([2, 0, 3]);
  expect(reset.rotation).toEqual([0, 0.6, 0]);
  expect(reset.scale).toBe(1.2);
  expect(reset.material).toEqual({ id: "oak" });
  expect(piece.modelOrientation).toEqual([0.707, 0, 0, 0.707]);
});