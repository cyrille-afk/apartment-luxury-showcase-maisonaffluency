import { describe, expect, it } from "vitest";
import { assertTearsheetBoardProject, requireTearsheetProject } from "./tearsheetProjectScope";

describe("project-first tearsheets", () => {
  it("requires a project before creating a board", () => {
    expect(() => requireTearsheetProject(null)).toThrow("Choose or create a project first.");
    expect(requireTearsheetProject("bangkok")).toBe("bangkok");
  });
  it("only adds pieces to a board under the selected project", () => {
    expect(() => assertTearsheetBoardProject("bangkok", "singapore")).toThrow();
    expect(() => assertTearsheetBoardProject("bangkok", null)).toThrow();
    expect(() => assertTearsheetBoardProject("bangkok", "bangkok")).not.toThrow();
  });
});