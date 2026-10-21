import { describe, expect, it } from "vitest";
import { resolveSwatchImageEvent } from "../swatchPreviewState";

describe("swatch preview pools", () => {
  it("hover only sets the preview, never the permanent photo", () => {
    expect(resolveSwatchImageEvent([5], { committed: false })).toEqual({ hoveredPreviewIndex: 4 });
  });
  it("mouse leave clears the preview", () => {
    expect(resolveSwatchImageEvent([2], { committed: false, restore: true })).toEqual({ hoveredPreviewIndex: null });
  });
  it("click commits the permanent photo and clears the preview", () => {
    expect(resolveSwatchImageEvent([3], { committed: true })).toEqual({ permanentIndex: 2, hoveredPreviewIndex: null });
  });
});
