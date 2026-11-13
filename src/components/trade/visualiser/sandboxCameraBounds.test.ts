import { describe, expect, it } from "vitest";
import { sandboxCameraPosition } from "./sandboxCameraBounds";

describe("Sandbox interior camera", () => {
  const room = { width: 12, depth: 8, height: 3 };
  it("keeps diagonal orbit positions 0.5m inside both walls", () => {
    expect(sandboxCameraPosition([20, 1.6, 20], room)).toEqual([5.5, 1.6, 3.5]);
    expect(sandboxCameraPosition([-20, 1.6, -20], room)).toEqual([-5.5, 1.6, -3.5]);
  });
  it("preserves an interior eye-level pose", () => {
    expect(sandboxCameraPosition([1, 1.6, 2], room)).toEqual([1, 1.6, 2]);
  });
  it("keeps restored camera heights clear of floor and ceiling", () => {
    expect(sandboxCameraPosition([0, -10, 0], room)).toEqual([0, 0.5, 0]);
    expect(sandboxCameraPosition([0, 10, 0], room)).toEqual([0, 2.5, 0]);
  });
});