import { describe, expect, it } from "vitest";
import { meshKey, resolvePart } from "./visualiserPartMapping";

describe("manual part mapping", () => {
  it("assigns a coded part to Frame / Base", () => {
    const key = meshKey(0, "a71bd6f1");
    expect(resolvePart("a71bd6f1", key, {})).toBeNull();
    expect(resolvePart("a71bd6f1", key, { [key]: "base" })).toBe("base");
  });
  it("manual choice overrides the automatic name match", () => {
    const key = meshKey(2, "FabricAndLeather");
    expect(resolvePart("fabricandleather", key, { [key]: "none" })).toBeNull();
    expect(resolvePart("fabricandleather", key, { [key]: "top" })).toBe("top");
  });
});
