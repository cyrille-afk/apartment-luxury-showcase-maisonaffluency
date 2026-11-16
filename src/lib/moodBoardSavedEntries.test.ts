import { describe, expect, it } from "vitest";
import { removableMoodBoardEntry, type MoodBoardSavedEntry } from "./moodBoardSavedEntries";

const entry: MoodBoardSavedEntry = { id: "duplicate-yoma", board_id: "mood-board", product_id: "yoma", variant_label: null, wood_label: null, fabric_label: null, procurement_quote_id: null, source_quote_item_id: null };
describe("saved Mood board removal", () => {
  it("allows an individual unlinked duplicate to be removed", () => {
    expect(removableMoodBoardEntry(entry)).toBe(true);
  });
  it("protects procurement-linked entries", () => {
    expect(removableMoodBoardEntry({ ...entry, procurement_quote_id: "quote" })).toBe(false);
  });
  it("protects source quote entries", () => {
    expect(removableMoodBoardEntry({ ...entry, source_quote_item_id: "line" })).toBe(false);
  });
});