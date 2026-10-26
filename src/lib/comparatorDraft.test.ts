import { describe, expect, it } from "vitest";
import { emptyComparatorDraft, filterComparatorDraftByLetter, searchComparatorDraft, restoreSavedComparison, sanitizeComparatorDraft } from "./comparatorDraft";

describe("selection filter interaction", () => {
  it("starts in the full catalogue with All active and no search", () => {
    expect(emptyComparatorDraft()).toMatchObject({ compareList: [], source: "catalogue", letter: "", search: "" });
  });
  it("clears the letter when searching for a designer or piece", () => {
    const next = searchComparatorDraft({ ...emptyComparatorDraft(), letter: "A" }, "Clam Chair");
    expect(next.search).toBe("Clam Chair");
    expect(next.letter).toBe("");
  });
  it("clears search when choosing a letter", () => {
    const next = filterComparatorDraftByLetter({ ...emptyComparatorDraft(), search: "Dagmar" }, "B");
    expect(next.search).toBe("");
    expect(next.letter).toBe("B");
  });
  it("clears search when returning to All", () => {
    const next = filterComparatorDraftByLetter({ ...emptyComparatorDraft(), search: "Dagmar" }, "");
    expect(next.search).toBe("");
    expect(next.letter).toBe("");
  });
});

describe("comparison cover edits", () => {
  it("preserves editable project and client details through draft restoration", () => {
    const edits = { projectName: "Bangkok Apartment", comparisonName: "Living room", clientName: "Cyrille Delval", location: "Bangkok", style: "Progressive luxury" };
    const restored = sanitizeComparatorDraft(JSON.parse(JSON.stringify({ coverEdits: { unassigned: edits } })));
    expect(restored.coverEdits.unassigned).toEqual(edits);
  });
  it("keeps intentional empty fields and excludes prices and unapproved metadata", () => {
    const restored = sanitizeComparatorDraft({ coverEdits: { unassigned: { clientName: "", trade_price_cents: 5000, internalNotes: "Private" } } });
    expect(restored.coverEdits.unassigned).toEqual({ clientName: "" });
  });
  it("keeps project-specific edits separate", () => {
    const projectId = "8f16a389-f13c-487a-83a2-01b81639e7dd";
    const restored = sanitizeComparatorDraft({ coverEdits: { [projectId]: { projectName: "Singapore" }, unassigned: { projectName: "Bangkok" } } });
    expect(restored.coverEdits[projectId].projectName).toBe("Singapore");
    expect(restored.coverEdits.unassigned.projectName).toBe("Bangkok");
  });
  it("persists the original-supplier-price PDF option as on by default and honours the off choice", () => {
    const on = sanitizeComparatorDraft({ coverEdits: { unassigned: {} } });
    expect((on.coverEdits.unassigned.originalPrices ?? "true") !== "false").toBe(true);
    const off = sanitizeComparatorDraft({ coverEdits: { unassigned: { originalPrices: "false" } } });
    expect((off.coverEdits.unassigned.originalPrices ?? "true") !== "false").toBe(false);
    const junk = sanitizeComparatorDraft({ coverEdits: { unassigned: { originalPrices: false } } });
    expect(junk.coverEdits.unassigned.originalPrices).toBeUndefined();
  });
});

describe("saved comparison restoration", () => {
  const saved = { id: "dais", product_name: "Dais", brand_name: "Alexander Lamont", category: "Seating", image_url: "https://example.com/dais.jpg", materials: "Leather" };
  it("restores the saved name and selection order while refreshing available catalogue details", () => {
    const live = { ...saved, product_name: "Dais Lounge Chair", materials: "Bouclé", tags: [] };
    const draft = restoreSavedComparison([saved, { ...saved, id: "ondas", product_name: "Ondas" }], "Living room", [live]);
    expect(draft.shortlistName).toBe("Living room");
    expect(draft.compareList.map(p => p.id)).toEqual(["dais", "ondas"]);
    expect(draft.compareList[0].materials).toBe("Bouclé");
  });
  it("keeps saved pieces absent from loaded catalogue data without restoring cached prices", () => {
    const draft = restoreSavedComparison([{ ...saved, trade_price_cents: 5000 }], "Archive", []);
    expect(draft.compareList[0].product_name).toBe("Dais");
    expect(draft.compareList[0]).not.toHaveProperty("trade_price_cents");
  });
});
describe("designer notes", () => {
  it("keeps notes only for compared pieces and restores them from saved items", async () => {
    const { sanitizeComparatorDraft, restoreSavedComparison } = await import("./comparatorDraft");
    const draft = sanitizeComparatorDraft({ compareList: [{ id: "a", product_name: "A" }], pieceNotes: { a: "Client loves oak", b: "stale" } });
    expect(draft.pieceNotes).toEqual({ a: "Client loves oak" });
    expect(restoreSavedComparison([{ id: "a", product_name: "A", designer_notes: "Check COM" }], "S", []).pieceNotes).toEqual({ a: "Check COM" });
  });
});
