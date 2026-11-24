import { describe, expect, it } from "vitest";
import { arModelTransform } from "./arModelTransform";

const gum = "/glb-models/f72b4185-9eeb-4ec0-b862-0972abc93a9f/default-1791609555869.glb";
const ibo = "/glb-models/fd8c2682-d8a1-48fe-b110-d22209cbcce7/default-1791611289330.glb";
describe("audited Delcourt AR source corrections", () => {
  it("converts GUM millimetres to metres and rotates positive Z upright", () => {
    expect(arModelTransform(gum)).toEqual({ scale: "0.001 0.001 0.001", orientation: "0deg -90deg 0deg", corrected: true });
    expect(900.506 * Number(arModelTransform(gum).scale.split(" ")[0])).toBeCloseTo(.900506, 6);
  });
  it("converts IBO centimetres to metres and rotates its tabletop upright", () => {
    expect(arModelTransform(ibo)).toEqual({ scale: "0.01 0.01 0.01", orientation: "0deg -90deg 0deg", corrected: true });
    expect(41 * Number(arModelTransform(ibo).scale.split(" ")[1])).toBeCloseTo(.41, 6);
  });
  it("composes size previews with source conversion instead of replacing them", () => {
    expect(arModelTransform(gum + "?revision=1", "2 1 1").scale).toBe("0.002 0.001 0.001");
  });
  it("does not rescale other makers or future replacement files", () => {
    expect(arModelTransform("/kerstens.glb", "2 1 1").scale).toBe("2 1 1");
    expect(arModelTransform(gum.replace("1791609555869", "9999999999999")).corrected).toBe(false);
  });
});