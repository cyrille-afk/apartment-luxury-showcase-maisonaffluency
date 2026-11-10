import { describe, it, expect } from "vitest";
import { resolveTearsheetActiveFolder } from "./tearsheetActiveFolder";
const P = "proj";
const folders = [
  { id: "sel", title: "Singapore GCB workflow — Selection", project_id: P },
  { id: "mop", title: "Man of Parts — curated edit", project_id: P },
  { id: "other", title: "Other", project_id: "x" },
];
describe("resolveTearsheetActiveFolder", () => {
  it("inherits the last visited sub-folder of the project", () => {
    expect(resolveTearsheetActiveFolder(folders, P, null, "mop")?.title).toBe("Man of Parts — curated edit");
  });
  it("URL folder wins over last visited", () => {
    expect(resolveTearsheetActiveFolder(folders, P, "sel", "mop")?.id).toBe("sel");
  });
  it("ignores folders from another project", () => {
    expect(resolveTearsheetActiveFolder(folders, P, "other", "other")).toBeNull();
  });
  it("explicit whole-project choice overrides last visited", () => {
    expect(resolveTearsheetActiveFolder(folders, P, "all", "mop")).toBeNull();
  });
});
