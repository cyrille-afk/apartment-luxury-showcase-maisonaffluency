import { describe, expect, it } from "vitest";
import { recentProjectBoards } from "./recentProjectBoards";

describe("recent project boards", () => {
  it("shows the top three newest boards without shortening their titles", () => {
    const boards = Array.from({ length: 5 }, (_, i) => ({ id: String(i), title: `Project ${i} — A complete residential project board name` }));
    expect(recentProjectBoards(boards)).toEqual([boards[0], boards[1], boards[2]]);
    expect(boards).toHaveLength(5);
  });
});