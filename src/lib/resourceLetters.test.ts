import { describe, expect, it } from "vitest";
import { brandInitial } from "./resourceLetters";

describe("brandInitial", () => {
  it("folds accents so Émile files under E", () => expect(brandInitial("Émile Gallé")).toBe("E"));
  it("files numbers and symbols under #", () => expect(brandInitial("1stDibs")).toBe("#"));
});
