import { describe, expect, it } from "vitest";
import { recentProjectBoards } from "./recentProjectBoards";

describe("recent project boards", () => {
  it("shows the top three newest boards without shortening their titles", () => {
    const boards = Array.from({ length: 5 }, (_, i) => ({ id: String(i), title: `Project ${i} — A complete residential project board name` }));
    expect(recentProjectBoards(boards)).toEqual([boards[0], boards[1], boards[2]]);
    expect(boards).toHaveLength(5);
  });
});
describe("recentProjectBoards last visited", () => {
  const b = [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }, { id: "d", title: "D" }];
  it("promotes the last visited folder to the top even when older", () => {
    expect(recentProjectBoards(b, "d").map((x) => x.id)).toEqual(["d", "a", "b"]);
  });
  it("ignores an unknown last visited id", () => {
    expect(recentProjectBoards(b, "zz").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});
