import { describe, expect, it } from "vitest";
import { canRetainPhotorealFrame } from "./visualiserPhotorealGhost";

describe("retained photoreal frames", () => {
  it("retains settled accumulated frames, including unlimited renders", () => {
    expect(canRetainPhotorealFrame(4000, 1000, 150, 3)).toBe(true);
    expect(canRetainPhotorealFrame(3, 150, 150, 3)).toBe(true);
  });
  it("rejects moving previews and incomplete initial accumulation", () => {
    expect(canRetainPhotorealFrame(4000, 149, 150, 3)).toBe(false);
    expect(canRetainPhotorealFrame(2.75, 1000, 150, 3)).toBe(false);
    expect(canRetainPhotorealFrame(Number.NaN, 1000, 150, 3)).toBe(false);
  });
});