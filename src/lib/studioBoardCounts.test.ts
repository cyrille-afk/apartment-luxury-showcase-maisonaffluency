import { expect, it } from "vitest";
import { studioBoardCount } from "./studioBoardCounts";

it("counts six remaining pieces after two Studio removals from eight", () => {
  const items = Array.from({ length: 8 }, (_, i) => ({ id: `item-${i}`, product_id: `product-${i}` }));
  const saved = [0, 1].map(i => ({ project_id: "project", item_key: `item-${i}`, selection: { excluded: true } }));
  expect(studioBoardCount(items, saved, "project")).toBe(6);
  expect(studioBoardCount(items, saved, "other-project")).toBe(8);
});

it("matches Studio grouping for duplicate configured entries and preserves other finishes", () => {
  const items = [{ id: "first", product_id: "sofa", wood_label: "Oak" }, { id: "duplicate", product_id: "sofa", wood_label: "Oak" }, { id: "different", product_id: "sofa", wood_label: "Walnut" }];
  expect(studioBoardCount(items, [{ item_key: "first", selection: { excluded: true } }], "project")).toBe(1);
  expect(studioBoardCount(items, [], "project")).toBe(3);
});