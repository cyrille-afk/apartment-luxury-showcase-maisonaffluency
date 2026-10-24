import { describe, expect, it } from "vitest";
import { isHistoryTraversalLoad } from "./legacyShell";

describe("preview last-page restore", () => {
  it("is skipped when the homepage is reached with browser Back/Forward", () => {
    expect(isHistoryTraversalLoad([{ type: "back_forward" }])).toBe(true);
  });
  it("still runs on fresh loads and refreshes", () => {
    expect(isHistoryTraversalLoad([{ type: "navigate" }])).toBe(false);
    expect(isHistoryTraversalLoad([{ type: "reload" }])).toBe(false);
    expect(isHistoryTraversalLoad([])).toBe(false);
  });
});
