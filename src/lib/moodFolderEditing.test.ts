import { expect, it } from "vitest";
import { folderChanges, moodFolderUrl } from "./moodFolderEditing";
it("removes only the exact missing saved row, not its duplicate product", () => {
  const original = [{ id: "yoma", folderItemId: "one" }, { id: "yoma", folderItemId: "two" }];
  expect(folderChanges(original, [original[1]]).removed.map(row => row.folderItemId)).toEqual(["one"]);
});
it("never removes procurement-locked rows or reinserts retained rows", () => {
  expect(folderChanges([{ id: "chair", folderItemId: "locked", locked: true }], [{ id: "lamp" }])).toEqual({ removed: [], added: [{ id: "lamp" }] });
});
it("carries the exact assigned folder and project to the item editor", () => {
  expect(moodFolderUrl("cipriani", "essential")).toBe("/trade/mood-boards?project=cipriani&board=essential");
});