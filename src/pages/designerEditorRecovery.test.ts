import { describe, expect, it } from "vitest";
import { recoverDesignerEditorDraft } from "./designerEditorRecovery";

const draft = {
  search: "Michel Amar",
  activeLetter: "A",
  expandedId: "michel-amar-id",
  editBuffer: { "michel-amar-id": { specialty: "Unsaved specialty" } },
};

describe("Designer Editor restoration", () => {
  it("preserves Michel Amar and unsaved data on an ordinary reload", () => {
    expect(recoverDesignerEditorDraft(draft, {}, false)).toEqual(draft);
  });
  it("collapses a failed restore without resetting the search or alphabet", () => {
    expect(recoverDesignerEditorDraft(draft, {}, true)).toEqual({ ...draft, expandedId: null });
  });
  it("honours explicitly cleared navigation instead of restoring an older filter", () => {
    expect(recoverDesignerEditorDraft(draft, { search: "", activeLetter: null, expandedId: null }, false))
      .toEqual({ ...draft, search: "", activeLetter: null, expandedId: null });
  });
});