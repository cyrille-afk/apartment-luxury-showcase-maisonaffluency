import { expect, it } from "vitest";
import { selectedStudioBoard, studioBoardItems } from "./studioBoardScope";
import { moodBoardHandoff } from "./moodBoardHandoff";

it("hands off the selected eleven rows, never the separate eight rows", () => {
  const rows = [ ...Array.from({ length: 11 }, (_, i) => ({ id: `selected-${i}`, board_id: "eleven" })), ...Array.from({ length: 8 }, (_, i) => ({ id: `other-${i}`, board_id: "eight" })) ];
  const selected = studioBoardItems(rows, "eleven");
  const layout = moodBoardHandoff(selected.map(row => ({ id: row.id, product_name: row.id, glb_url: null, retailCents: null })), "project", "living", null, 123);
  expect(layout.items).toHaveLength(11);
  expect(layout.items.map(item => item.productId)).toEqual(Array.from({ length: 11 }, (_, i) => `selected-${i}`));
});
it("never treats missing or invalid selection as all boards", () => {
  const boards = [{ id: "eleven" }, { id: "eight" }];
  expect(selectedStudioBoard(boards, null)).toBeNull();
  expect(selectedStudioBoard(boards, "deleted")).toBeNull();
  expect(selectedStudioBoard(boards, "eleven")).toEqual({ id: "eleven" });
});
it("can select the only accessible board without combining sources", () => {
  expect(selectedStudioBoard([{ id: "eleven" }], null)).toEqual({ id: "eleven" });
  expect(selectedStudioBoard([], null)).toBeNull();
});