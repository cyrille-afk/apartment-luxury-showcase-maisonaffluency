import { describe, expect, it } from "vitest";
import { resolveStudioSelection, studioVisibleItems } from "./studioFinishes";

describe("manual Studio canvas removal", () => {
  it("keeps a saved removal excluded when finishes are restored", () => {
    const selection = resolveStudioSelection({ name: "Chair", variants: [], finishes: [] }, null, { ids: {}, locked: true, excluded: true });
    expect(selection.excluded).toBe(true);
    expect(selection.locked).toBe(true);
  });
  it("removes only the selected configured instance from composition and handoff", () => {
    const items = [{ id: "removed", selection: { ids: {}, locked: false, excluded: true } }, { id: "other-finish", selection: { ids: {}, locked: false } }];
    expect(studioVisibleItems(items).map(item => item.id)).toEqual(["other-finish"]);
    expect(items).toHaveLength(2);
  });
});