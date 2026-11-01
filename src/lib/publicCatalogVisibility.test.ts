import { describe, expect, it } from "vitest";
import { filterPublicPicks } from "./publicCatalogVisibility";

const designers = [
  { id: "public", is_published: true, trade_only: false },
  { id: "trade", is_published: true, trade_only: true },
  { id: "draft", is_published: false, trade_only: false },
];

describe("filterPublicPicks", () => {
  it("removes pieces from Trade Only designers", () => {
    const out = filterPublicPicks([{ id: "a", designer_id: "trade" }, { id: "b", designer_id: "public" }], designers);
    expect(out.map((p) => p.id)).toEqual(["b"]);
  });

  it("removes pieces from unpublished or unknown designers", () => {
    const out = filterPublicPicks(
      [{ id: "a", designer_id: "draft" }, { id: "b", designer_id: "missing" }, { id: "c", designer_id: null }],
      designers,
    );
    expect(out).toEqual([]);
  });
});
